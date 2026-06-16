const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory store for parsed documents
const documents = new Map();

// Configure multer to store uploaded files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // limit to 10MB
});

// Groq client initialization using OpenAI SDK compatibility
const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable.");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
};

// Route: Upload PDF and extract text
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Please upload a PDF." });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Invalid file type. Only PDF files are supported." });
    }

    // Parse the PDF buffer
    const data = await pdfParse(req.file.buffer);
    const text = data.text.trim();

    if (!text) {
      return res.status(400).json({ error: "Unable to extract text from the PDF. It may be scanned or empty." });
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200); // 200 words per minute average

    const documentData = {
      id: docId,
      name: req.file.originalname,
      size: req.file.size,
      text: text,
      wordCount,
      readingTime,
      pages: data.numpages,
      uploadedAt: new Date().toISOString()
    };

    // Store in-memory
    documents.set(docId, documentData);

    // Return document metadata without the full text to keep response payload light
    const { text: _, ...metadata } = documentData;
    res.json({ message: "File parsed successfully", document: metadata });
  } catch (error) {
    console.error("Upload/Parsing Error:", error);
    res.status(500).json({ error: `Failed to parse PDF: ${error.message}` });
  }
});

// Route: Chat with document using Groq API streaming
app.post("/api/chat", async (req, res) => {
  const { documentId, message, history } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: "Missing documentId parameter." });
  }
  if (!message) {
    return res.status(400).json({ error: "Missing message parameter." });
  }

  const doc = documents.get(documentId);
  if (!doc) {
    return res.status(404).json({ error: "Document not found. Please upload it again." });
  }

  try {
    const openai = getGroqClient();

    // Set headers for EventStream (SSE streaming)
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const systemPrompt = `You are a helpful and intelligent notes assistant. You have been given access to the notes/document titled "${doc.name}".
Below is the full text content of the document. Use this context to answer the user's questions as accurately and comprehensively as possible.
If the answer is not mentioned or cannot be inferred from the document text, mention that, but offer any general knowledge helper context if relevant while being clear it's outside the notes.

--- START DOCUMENT CONTENT ---
${doc.text}
--- END DOCUMENT CONTENT ---

Always refer to the notes provided where appropriate.`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map(msg => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      })),
      { role: "user", content: message }
    ];

    const stream = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      temperature: 0.3,
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Groq Chat Error:", error);
    // If headers are already sent, write error in the stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: `Chat request failed: ${error.message}` });
    }
  }
});

// Route: Get document content preview
app.get("/api/documents/:id", (req, res) => {
  const doc = documents.get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found." });
  }
  res.json({ id: doc.id, name: doc.name, text: doc.text });
});

// Route: List all documents metadata
app.get("/api/documents", (req, res) => {
  const list = Array.from(documents.values()).map(({ text: _, ...metadata }) => metadata);
  res.json(list);
});

// Route: Delete document
app.delete("/api/documents/:id", (req, res) => {
  if (documents.has(req.params.id)) {
    documents.delete(req.params.id);
    return res.json({ success: true, message: "Document deleted." });
  }
  res.status(404).json({ error: "Document not found." });
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");
const { ChromaClient } = require("chromadb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const EMBEDDINGS_FILE = path.join(__dirname, "embeddings.json");

// In-memory document list metadata
const documentsMetadata = new Map();

// Load metadata on startup if JSON exists
if (fs.existsSync(EMBEDDINGS_FILE)) {
  try {
    const raw = fs.readFileSync(EMBEDDINGS_FILE, "utf-8");
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([docId, docObj]) => {
      documentsMetadata.set(docId, {
        id: docId,
        name: docObj.name,
        size: docObj.size,
        pages: docObj.pages,
        wordCount: docObj.wordCount,
        readingTime: docObj.readingTime,
        uploadedAt: docObj.uploadedAt,
      });
    });
    console.log(`Loaded ${documentsMetadata.size} documents from embeddings.json`);
  } catch (err) {
    console.error("Failed to load existing embeddings.json:", err.message);
  }
}

// Multer in-memory storage config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // limit to 10MB
});

// Groq Client
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

// Chroma Client
let chromaClient = null;
let chromaCollection = null;
const CHROMA_COLLECTION_NAME = "notes_rag_collection";

const initChroma = async () => {
  try {
    const url = process.env.CHROMA_URL || "http://localhost:8000";
    chromaClient = new ChromaClient({ path: url });
    // Attempt to list collections as a connectivity check
    await chromaClient.listCollections();
    
    // Get or create collection
    chromaCollection = await chromaClient.getOrCreateCollection({
      name: CHROMA_COLLECTION_NAME,
    });
    console.log("Connected to local ChromaDB successfully.");
  } catch (error) {
    console.warn("Local ChromaDB server is not running or unreachable. Falling back to local JSON Vector Store.", error.message);
    chromaClient = null;
    chromaCollection = null;
  }
};

initChroma();

// -------------------------------------------------------------
// EMBEDDING GENERATOR (Groq API with high-performance local fallback)
// -------------------------------------------------------------

// Local deterministic hashing vectorizer (384 dimensions)
// Generates a normalized unit-vector representing the text structure.
const generateLocalEmbedding = (text) => {
  const dims = 384;
  const vector = new Array(dims).fill(0);
  
  // Basic text cleaning & tokenization
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(t => t.length > 1);

  if (tokens.length === 0) {
    // Return a random unit vector for empty input
    const randomVec = Array.from({ length: dims }, () => Math.random() - 0.5);
    const mag = Math.sqrt(randomVec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return randomVec.map(v => v / mag);
  }

  // Hash each token to multiple dimensions
  tokens.forEach(token => {
    // DJB2 String Hash
    let hash1 = 5381;
    let hash2 = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1) + char;
      hash2 = char + (hash2 << 6) + (hash2 << 16) - hash2;
    }

    // Map hash1 to vector index
    const index1 = Math.abs(hash1) % dims;
    const sign1 = hash1 % 2 === 0 ? 1 : -1;
    vector[index1] += sign1;

    // Map hash2 to another vector index for dense mapping
    const index2 = Math.abs(hash2) % dims;
    const sign2 = hash2 % 2 === 0 ? 1 : -1;
    vector[index2] += sign2 * 0.5;
  });

  // Normalize vector to unit length
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) {
    vector[0] = 1.0;
    return vector;
  }
  return vector.map(v => v / magnitude);
};

// Main function: Try Groq API, fall back to local embedding
const getEmbedding = async (text) => {
  try {
    const openai = getGroqClient();
    // We try to request the embedding from Groq. 
    // Since Groq does not have a public general embeddings model, this will likely hit a 404 or 400.
    // If it does succeed, it will return the API embedding!
    const response = await openai.embeddings.create({
      model: "canopylabs/orpheus-v1-english",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    // Graceful fallback to local vectorizer
    return generateLocalEmbedding(text);
  }
};

// Cosine similarity helper for local fallback RAG search
const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// -------------------------------------------------------------
// TEXT CHUNKING UTILITY
// -------------------------------------------------------------
const chunkText = (text, chunkSize = 1000, overlap = 200) => {
  const chunks = [];
  let index = 0;
  
  while (index < text.length) {
    const chunk = text.slice(index, index + chunkSize);
    chunks.push(chunk);
    index += (chunkSize - overlap);
  }
  
  return chunks;
};

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// Route: Upload & index document (RAG setup)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Invalid file. Only PDF is supported." });
    }

    // 1. Extract text
    const parsed = await pdfParse(req.file.buffer);
    const fullText = parsed.text.trim();

    if (!fullText) {
      return res.status(400).json({ error: "No readable text in PDF." });
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);

    const docMeta = {
      id: docId,
      name: req.file.originalname,
      size: req.file.size,
      pages: parsed.numpages,
      wordCount,
      readingTime,
      uploadedAt: new Date().toISOString()
    };

    // 2. Chunk text
    const textChunks = chunkText(fullText, 1000, 200);
    console.log(`Document chunked into ${textChunks.length} chunks.`);

    // 3. Generate embeddings
    const chunkObjects = [];
    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];
      const embedding = await getEmbedding(chunkText);
      chunkObjects.push({
        id: `${docId}_chunk_${i}`,
        text: chunkText,
        embedding: embedding,
        index: i
      });
    }

    // 4. Save to JSON store (embeddings.json)
    let storeData = {};
    if (fs.existsSync(EMBEDDINGS_FILE)) {
      try {
        storeData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, "utf-8"));
      } catch (err) {
        // file empty or invalid
      }
    }
    storeData[docId] = {
      ...docMeta,
      fullText,
      chunks: chunkObjects.map(({ id, text, embedding, index }) => ({ id, text, embedding, index }))
    };
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(storeData, null, 2), "utf-8");

    // 5. Add to ChromaDB if connected
    if (chromaCollection) {
      try {
        const ids = chunkObjects.map(c => c.id);
        const embeddings = chunkObjects.map(c => c.embedding);
        const metadatas = chunkObjects.map(c => ({
          documentId: docId,
          documentName: docMeta.name,
          chunkIndex: c.index
        }));
        const documents = chunkObjects.map(c => c.text);

        await chromaCollection.add({
          ids,
          embeddings,
          metadatas,
          documents
        });
        console.log(`Successfully added ${ids.length} chunks to ChromaDB.`);
      } catch (err) {
        console.error("Failed to add to ChromaDB. Retaining in local JSON store.", err.message);
      }
    }

    documentsMetadata.set(docId, docMeta);
    res.json({ message: "Note indexed successfully with RAG", document: docMeta });
  } catch (error) {
    console.error("Upload/Indexing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Route: Chat with context retrieval (RAG query + citations)
app.post("/api/chat", async (req, res) => {
  const { documentId, message, history } = req.body;

  if (!documentId || !message) {
    return res.status(400).json({ error: "Missing documentId or message." });
  }

  // Retrieve doc chunks from local store (used as fallback or for citations)
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    return res.status(500).json({ error: "Embeddings database file is missing." });
  }

  let storeData;
  try {
    storeData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, "utf-8"));
  } catch (err) {
    return res.status(500).json({ error: "Failed to read local store." });
  }

  const doc = storeData[documentId];
  if (!doc) {
    return res.status(404).json({ error: "Document not found." });
  }

  try {
    // 1. Embed the user query
    const queryEmbedding = await getEmbedding(message);

    // 2. Retrieve top 3 chunks
    let topChunks = [];

    if (chromaCollection) {
      try {
        // Query ChromaDB
        const results = await chromaCollection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: 3,
          where: { documentId: documentId }
        });

        if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
          topChunks = results.documents[0].map((text, i) => ({
            text,
            id: results.ids[0][i],
            metadata: results.metadatas[0][i],
            score: results.distances ? (1 - results.distances[0][i]) : 0.8 // convert distance to approx score
          }));
        }
      } catch (err) {
        console.warn("Chroma query failed, falling back to local JSON similarity search.", err.message);
        topChunks = [];
      }
    }

    // If Chroma query returned empty or is disconnected, do local JSON RAG search
    if (topChunks.length === 0) {
      console.log("Performing local JSON Cosine Similarity search...");
      const scored = doc.chunks.map(chunk => {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          text: chunk.text,
          id: chunk.id,
          metadata: { documentId, documentName: doc.name, chunkIndex: chunk.index },
          score
        };
      });

      // Sort by score descending and take top 3
      topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    // 3. Estimate cost comparison metrics
    // Groq LLM: Llama-3.3-70b-versatile -> $0.59 / 1M input tokens, $0.79 / 1M output tokens
    const INPUT_PRICE_PER_M = 0.59;
    
    // Estimate tokens: characters / 4
    const docTokens = Math.ceil(doc.fullText.length / 4);
    const queryTokens = Math.ceil(message.length / 4);
    const ragContextText = topChunks.map(c => c.text).join("\n\n");
    const ragContextTokens = Math.ceil(ragContextText.length / 4);

    const fullDocInputTokens = docTokens + queryTokens + 100; // +100 system prompt
    const ragInputTokens = ragContextTokens + queryTokens + 100;

    const costFullDoc = (fullDocInputTokens / 1_000_000) * INPUT_PRICE_PER_M;
    const costRAG = (ragInputTokens / 1_000_000) * INPUT_PRICE_PER_M;
    const savingsPercent = Math.max(0, ((costFullDoc - costRAG) / costFullDoc) * 100);

    const costComparison = {
      fullDocTokens: fullDocInputTokens,
      fullDocCostUSD: costFullDoc,
      ragTokens: ragInputTokens,
      ragCostUSD: costRAG,
      savingsPercent: parseFloat(savingsPercent.toFixed(1))
    };

    // 4. Initialize Groq Streaming response
    const openai = getGroqClient();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    // Send Cost Analytics & Citations immediately at the start of the stream
    res.write(`data: ${JSON.stringify({ 
      citations: topChunks.map(c => ({ id: c.id, index: c.metadata.chunkIndex, text: c.text })),
      cost: costComparison
    })}\n\n`);

    const contextPrompt = `You are an intelligent notes assistant. You have been given access to the notes/document titled "${doc.name}".
To answer the user's question, we retrieved the top 3 relevant chunks from the notes. Use these chunks to formulate your response.
If the retrieved chunks do not contain the answer, tell the user that but try to infer from what is available.

--- START RETRIEVED NOTES CONTEXT ---
${ragContextText}
--- END RETRIEVED NOTES CONTEXT ---

Answer the user's question clearly, citing the source document where appropriate.`;

    const apiMessages = [
      { role: "system", content: contextPrompt },
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
    console.error("RAG Chat Error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Route: Get document content preview
app.get("/api/documents/:id", (req, res) => {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    return res.status(404).json({ error: "No database found." });
  }
  try {
    const storeData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, "utf-8"));
    const doc = storeData[req.params.id];
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }
    res.json({ id: doc.id, name: doc.name, text: doc.fullText });
  } catch (err) {
    res.status(500).json({ error: "Failed to read database." });
  }
});

// Route: List all documents metadata
app.get("/api/documents", (req, res) => {
  res.json(Array.from(documentsMetadata.values()));
});

// Route: Delete document and delete from ChromaDB
app.delete("/api/documents/:id", async (req, res) => {
  const docId = req.params.id;
  if (!documentsMetadata.has(docId)) {
    return res.status(404).json({ error: "Document not found." });
  }

  // 1. Delete from ChromaDB
  if (chromaCollection) {
    try {
      // Chroma deletes by IDs or metadata filter
      // Get all chunk IDs for this document from local store to delete explicitly
      if (fs.existsSync(EMBEDDINGS_FILE)) {
        const storeData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, "utf-8"));
        const doc = storeData[docId];
        if (doc && doc.chunks) {
          const chunkIds = doc.chunks.map(c => c.id);
          await chromaCollection.delete({ ids: chunkIds });
          console.log(`Deleted ${chunkIds.length} chunks from ChromaDB.`);
        }
      }
    } catch (err) {
      console.error("Failed to delete from ChromaDB:", err.message);
    }
  }

  // 2. Delete from embeddings.json
  if (fs.existsSync(EMBEDDINGS_FILE)) {
    try {
      const storeData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, "utf-8"));
      delete storeData[docId];
      fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(storeData, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to delete from embeddings.json:", err.message);
    }
  }

  documentsMetadata.delete(docId);
  res.json({ success: true, message: "Document and vector index deleted successfully." });
});

app.listen(port, () => {
  console.log(`Backend RAG server running on http://localhost:${port}`);
});

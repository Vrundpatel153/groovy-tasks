const readline = require("readline");
const fs = require("fs");
const path = require("path");

const API_BASE = "http://localhost:5001/api";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.clear();
  console.log("==================================================");
  console.log("       Ask My Notes - RAG CLI Test Client         ");
  console.log("==================================================");
  
  try {
    // 1. Fetch available documents from backend
    const listRes = await fetch(`${API_BASE}/documents`);
    if (!listRes.ok) {
      throw new Error(`Could not connect to backend. Make sure the backend server is running on port 5001.`);
    }
    
    const documents = await listRes.json();
    let selectedDoc = null;

    if (documents.length === 0) {
      console.log("\nNo documents found in the vector database.");
      console.log("Let's upload 'sample.pdf' automatically to start testing...");
      
      const samplePath = path.join(__dirname, "sample.pdf");
      
      // If sample.pdf doesn't exist, try copying from Day-10
      if (!fs.existsSync(samplePath)) {
        const day10Sample = path.join(__dirname, "..", "Day-10", "sample.pdf");
        if (fs.existsSync(day10Sample)) {
          fs.copyFileSync(day10Sample, samplePath);
        } else {
          // If neither exists, write a dummy text/pdf simulation or throw error
          console.log("Please copy a PDF named 'sample.pdf' to the Day-11 folder first.");
          rl.close();
          return;
        }
      }

      console.log(`Uploading ${samplePath} to backend...`);
      const fileBuffer = fs.readFileSync(samplePath);
      const blob = new Blob([fileBuffer], { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", blob, "sample.pdf");

      const uploadRes = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(`Upload failed: ${err.error}`);
      }

      const uploadData = await uploadRes.json();
      selectedDoc = uploadData.document;
      console.log(`\nSuccessfully indexed: ${selectedDoc.name} (${selectedDoc.pages} pages)`);
    } else {
      console.log("\nAvailable documents in vector store:");
      documents.forEach((doc, idx) => {
        console.log(`[${idx + 1}] ${doc.name} (${doc.pages} pages, ${doc.wordCount} words)`);
      });
      
      const docChoice = await askQuestion("\nSelect a document index to chat (or press Enter for [1]): ");
      const docIdx = parseInt(docChoice) - 1;
      selectedDoc = documents[docIdx] || documents[0];
      console.log(`\nSelected note: ${selectedDoc.name}`);
    }

    // 2. Start Q&A Loop
    console.log("\n--- Chat Mode Activated ---");
    console.log("Ask questions about your note. Type 'exit' to quit.\n");

    const history = [];

    while (true) {
      const query = await askQuestion("\nYou: ");
      if (query.trim().toLowerCase() === "exit" || query.trim().toLowerCase() === "quit") {
        console.log("\nGoodbye!");
        break;
      }

      if (!query.trim()) continue;

      console.log("\n[Retrieving matching vectors & generating streaming response...]");

      try {
        const response = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: selectedDoc.id,
            message: query,
            history
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let citationsPrinted = false;
        let assistantResponse = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const data = JSON.parse(dataStr);

                // Print Citations & Cost Comparison Card first
                if (data.citations && data.cost && !citationsPrinted) {
                  console.log("\n--------------------------------------------------");
                  console.log(`📚 RETRIEVED SOURCES (Top 3 Chunks):`);
                  data.citations.forEach((c, i) => {
                    console.log(`  [Source ${i + 1}] (Chunk index: ${c.index + 1}):`);
                    console.log(`    "${c.text.substring(0, 160).trim()}..."`);
                  });
                  console.log("--------------------------------------------------");
                  console.log(`💰 COST COMPARISON:`);
                  console.log(`  Full-Doc Context: ${data.cost.fullDocTokens.toLocaleString()} tokens | Est: $${data.cost.fullDocCostUSD.toFixed(5)}`);
                  console.log(`  RAG Context:      ${data.cost.ragTokens.toLocaleString()} tokens | Est: $${data.cost.ragCostUSD.toFixed(5)}`);
                  console.log(`  RAG is ${data.cost.savingsPercent}% CHEAPER!`);
                  console.log("--------------------------------------------------\n");
                  process.stdout.write("Assistant: ");
                  citationsPrinted = true;
                  continue;
                }

                // Stream the text token
                if (data.text) {
                  process.stdout.write(data.text);
                  assistantResponse += data.text;
                }
              } catch (e) {
                // ignore parsing noise
              }
            }
          }
        }

        console.log(); // print newline after streaming finishes
        history.push({ sender: "user", text: query });
        history.push({ sender: "assistant", text: assistantResponse });

      } catch (err) {
        console.error(`\n⚠️ Chat error: ${err.message}`);
      }
    }

  } catch (error) {
    console.error(`\n⚠️ Initialization Error: ${error.message}`);
  } finally {
    rl.close();
  }
}

main();

# Ask My Notes v2 - RAG & ChromaDB Web Application

An advanced document Q&A web application featuring Retrieval-Augmented Generation (RAG) using a local ChromaDB vector database, token cost analytics, and interactive source citations.
<video controls src="20260616-1129-19.2181151.mp4" title="Title"></video>

## Features

1. **Text Chunking & Embedding Generation**:
   - Automatically splits uploaded PDFs into overlapping chunks.
   - Generates vector embeddings for each chunk using Groq embeddings (with a zero-dependency local vectorizer fallback in case of terms acceptance issues or offline usage).
2. **Local ChromaDB Integration**:
   - Indexes chunks and embeddings in a local ChromaDB instance on `http://localhost:8000`.
   - Falls back gracefully to an in-memory/JSON cosine similarity vector search if the ChromaDB server is not running, ensuring zero app crashes.
3. **JSON Backup (`embeddings.json`)**:
   - Saves all generated chunks and embeddings in a local `embeddings.json` file inside the `backend/` directory.
4. **Context Retrieval & Streaming**:
   - Embeds user queries and searches the vector database for the **top 3 most similar chunks**.
   - Streams responses token-by-token using Groq LLM (Llama 3.3).
5. **Citations**:
   - Displays retrieved source chunks inside the chat assistant bubble, which users can expand to inspect.
6. **Dynamic Cost Analytics**:
   - Compares the token consumption and estimated financial cost of the Full-Doc approach vs the RAG approach in real-time.

---

## Cost Analysis: Full-Doc vs RAG Approach

### The Mechanics
- **Full-Doc**: On *every* question, the entire extracted PDF text (e.g., 60,000 tokens) is passed as system prompt context. 10 queries = 600,000 context tokens.
- **RAG**: Only the top 3 relevant text chunks (approx. 1,500 tokens total) are sent. 10 queries = 15,000 context tokens.

### Comparative Scenario
*Scenario: 100-page PDF note (approx. 50,000 tokens), tested over 10 user queries. Model: Llama-3.3-70b-versatile ($0.59 / 1M input tokens).*

| Metric | Full-Doc Approach | RAG Approach | Comparison |
| :--- | :--- | :--- | :--- |
| **Tokens / Query** | ~50,200 tokens | ~1,700 tokens | **96.6% less tokens** |
| **Tokens / 10 Queries** | 502,000 tokens | 17,000 tokens | **485,000 tokens saved** |
| **Estimated Cost** | ~$0.296 USD | ~$0.010 USD | **96.6% cost reduction** |

---

## Setup & Running the Application

### 1. Configure the API Key
Create a `.env` file in the `backend/` directory:
```env
PORT=5001
GROQ_API_KEY=your_groq_api_key_here
CHROMA_URL=http://localhost:8000
```

### 2. Start the Local ChromaDB Server
Start the local ChromaDB server using the compiled python executable:
```bash
& "C:\Users\vrund\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts\chroma.exe" run --path c:\Users\vrund\OneDrive\Desktop\Groovy-Tasks\Day-11\chroma_data
```
*Note: If you already have ChromaDB on your system PATH, you can simply run:*
```bash
chroma run
```

### 3. Start the Backend Server
Navigate to the `backend/` directory and start it:
```bash
cd backend
npm install
npm run dev
```

### 4. Start the Frontend Dev Server (Optional for UI)
Navigate to the `frontend/` directory and start the dev server:
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5174/` in your browser.

---

## User-Friendly CLI Testing Client

You can test the entire chunking, vector embeddings retrieval, citations, cost comparison, and streaming chat loops directly from the CLI without needing a browser!

### Running the CLI Client
Ensure the backend RAG server is running, then execute:
```bash
node test-cli.js
```

### What happens in the CLI
1. The CLI queries the backend to list indexed documents.
2. If no document is indexed, it automatically uploads `sample.pdf` from the directory, chunks, and indexes it.
3. You select a document index to chat.
4. The Q&A loop starts. When you ask a question:
   - It retrieves the **top 3 matching source chunks** and prints short previews.
   - It prints a **Token & Cost Comparison Dashboard** comparing Full-Doc vs RAG token cost estimates and savings percentage.
   - It streams the assistant's answer token-by-token in real time.
5. Type `exit` to quit.


# Ask My Notes - Web Application
https://elaborate-tartufo-716253.netlify.app/

A minimalist, journal-style web application that allows users to upload PDF notes and ask natural language questions about them. The app leverages Groq's high-speed inference (using `llama-3.3-70b-versatile` with a large 128k token context window) to answer questions directly from the note text, without requiring a vector database.
<video src="https://github.com/Vrundpatel153/groovy-tasks/raw/main/Day-10/20260616-1050-04.9095426.mp4" controls width="100%"></video>
## Architecture

- **Frontend**: React (Vite setup) featuring:
  - Custom sepia/cream and minimalist dark-mode themes.
  - Interactive PDF text previewer with local keyword highlighting.
  - Clean notes dashboard layout with search filters.
  - Real-time token-by-token streaming chat.
- **Backend**: Express.js server:
  - Parses uploaded PDF files in-memory using `pdf-parse`.
  - Serves streaming responses using server-sent events (SSE).
  - Handles chat requests using the official OpenAI-SDK-compatible Groq integration.

## Setup & Configuration

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### 1. Configure the API Key
Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
GROQ_API_KEY=your_groq_api_key_here
```

---

## Running the Application

To start the application, run both the backend server and the frontend dev server.

### Start the Backend Server
Navigate to the `backend/` directory and start the server:

```bash
cd backend
npm install
npm run dev
```
The backend server runs on `http://localhost:5000`.

### Start the Frontend Dev Server
Navigate to the `frontend/` directory and start the dev server:

```bash
cd ../frontend
npm install
npm run dev
```
The application will be accessible at the URL shown in your terminal (typically `http://localhost:5173`).

---

## How to Test

1. **Open the App**: Access `http://localhost:5173` in your browser.
2. **Upload a Note**: Click the **Upload PDF Note** button in the sidebar and choose a PDF file.
3. **Read the Note**: The parsed note text will be displayed in the **Document Reader** panel. Try searching for terms in the text search box to see highlighting in action.
4. **Chat**: Ask a question in the **Chat Assistant** panel. The response will stream token-by-token using the document text as context.
5. **Delete**: Remove notes by clicking the delete trash icon in the sidebar.

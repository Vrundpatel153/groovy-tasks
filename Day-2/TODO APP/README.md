# todo-app-groovy
<img width="1898" height="982" alt="image" src="https://github.com/user-attachments/assets/053430ef-2b10-4b03-8e78-87fb01105086" />

## Installation

Install and run the server:

```bash
cd server
npm install
npm start
```

Install and run the client in a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the app at `http://127.0.0.1:3000`. The API runs at `http://localhost:5000/todos`.

## Prompt

Create a minimal full-stack TODO app, React + Node, in this structure:

```
/server
  - server.js (Express, port 5000, CORS enabled)
  - In-memory array for todos (no DB)
  - Routes: GET /todos, POST /todos, PATCH /todos/:id, DELETE /todos/:id
  - Each todo: { id, text, done }

/client
  - Vite + React app (port 5173)
  - Single App.jsx with: input + add button, list of todos with checkbox (toggle done) and delete button
  - Fetch calls to http://localhost:5000/todos for all CRUD ops
  - Minimal inline CSS, no extra libraries

Output only the code for: server.js, client/src/App.jsx, client/src/main.jsx, and package.json files for both folders. No explanations, no comments beyond essential ones.
```

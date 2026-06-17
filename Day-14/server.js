import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Import agents dynamically/statically
import { runAgent as runPureAgent } from './pure-sdk-agent/agent.js';
import { runAgent as runLangchainAgent } from './langchain-agent/agent.js';
import { runAgent as runLlamaindexAgent } from './llamaindex-agent/agent.js';

// Endpoint for Pure SDK
app.post('/pure-sdk', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const start = performance.now();
    const result = await runPureAgent(message);
    const latencyMs = Math.round(performance.now() - start);
    res.json({ ...result, latencyMs });
  } catch (error) {
    console.error('Pure SDK Agent Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred' });
  }
});

// Endpoint for LangChain
app.post('/langchain', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const start = performance.now();
    const result = await runLangchainAgent(message);
    const latencyMs = Math.round(performance.now() - start);
    res.json({ ...result, latencyMs });
  } catch (error) {
    console.error('LangChain Agent Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred' });
  }
});

// Endpoint for LlamaIndex
app.post('/llamaindex', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const start = performance.now();
    const result = await runLlamaindexAgent(message);
    const latencyMs = Math.round(performance.now() - start);
    res.json({ ...result, latencyMs });
  } catch (error) {
    console.error('LlamaIndex Agent Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred' });
  }
});

// Serve frontend React application built files
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// Fallback all GET routes to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Express routing server running on port ${port}`);
});

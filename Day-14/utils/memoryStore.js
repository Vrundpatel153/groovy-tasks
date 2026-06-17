import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_FILE_PATH = path.join(__dirname, '..', 'agent_memory.json');

// Helper to read memory from disk
function readMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE_PATH)) {
      const data = fs.readFileSync(MEMORY_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading memory file:', err);
  }
  return {
    shortTerm: {}, // agentName -> Array of messages
    longTerm: {}   // agentName -> Array of strings (facts)
  };
}

// Helper to write memory to disk
function writeMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(memory, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing memory file:', err);
  }
}

export function getShortTermMemory(agentName) {
  const memory = readMemory();
  return memory.shortTerm[agentName] || [];
}

export function addShortTermMemory(agentName, role, content) {
  const memory = readMemory();
  if (!memory.shortTerm[agentName]) {
    memory.shortTerm[agentName] = [];
  }
  memory.shortTerm[agentName].push({ role, content });
  // Limit short-term memory to last 10 messages
  if (memory.shortTerm[agentName].length > 10) {
    memory.shortTerm[agentName].shift();
  }
  writeMemory(memory);
}

export function getLongTermMemory(agentName) {
  const memory = readMemory();
  return memory.longTerm[agentName] || [];
}

export function addLongTermMemoryFact(agentName, fact) {
  const memory = readMemory();
  if (!memory.longTerm[agentName]) {
    memory.longTerm[agentName] = [];
  }
  if (!memory.longTerm[agentName].includes(fact)) {
    memory.longTerm[agentName].push(fact);
  }
  writeMemory(memory);
}

export function clearMemory(agentName) {
  const memory = readMemory();
  if (agentName) {
    memory.shortTerm[agentName] = [];
    memory.longTerm[agentName] = [];
  } else {
    memory.shortTerm = {};
    memory.longTerm = {};
  }
  writeMemory(memory);
}

// Extract long-term facts in the background using Groq
export async function updateLongTermMemory(agentName, userMessage, assistantResponse) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return;

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.groq.com/openai/v1'
  });

  const existingFacts = getLongTermMemory(agentName);
  
  const systemPrompt = `You are a memory processor. Your task is to extract any key facts, user preferences, or details from the conversation and return them as a clean JSON object containing an array of strings under the key "facts". Only extract facts that are persistent (e.g. name, location, likes, dislikes, favorite things).
Existing facts: ${JSON.stringify(existingFacts)}

Return ONLY a JSON object of new facts extracted from this exchange, or an empty array under "facts" if no new facts are found. Output ONLY the JSON. Do not include any explanation or markdown formatting.
Example format:
{
  "facts": ["User's name is Vrund", "User lives in Seattle"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant', // fast model for quick background tasks
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `User: ${userMessage}\nAssistant: ${assistantResponse}` }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content.trim();
    const parsed = JSON.parse(content);
    const newFacts = parsed.facts || [];

    if (newFacts && newFacts.length > 0) {
      newFacts.forEach(fact => {
        addLongTermMemoryFact(agentName, fact);
      });
    }
  } catch (error) {
    console.error('Failed to update long term memory:', error.message);
  }
}

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/vrund/OneDrive/Desktop/Groovy-Tasks/Day-14/.env' });

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

const tools = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform basic arithmetic operations: add, subtract, multiply, or divide two numbers.',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['operation', 'a', 'b']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using Tavily for up-to-date information, news, or general knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query string' }
        },
        required: ['query']
      }
    }
  }
];

async function test(modelName, messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      tools: tools,
      tool_choice: 'auto'
    });
    console.log(`Model ${modelName} Success:`, JSON.stringify(completion.choices[0].message, null, 2));
  } catch (error) {
    console.error(`Model ${modelName} Error:`, error.message);
  }
}

const systemPrompt = `You are a helpful assistant with access to two tools: calculator and web_search. 
Call calculator for math operations, and call web_search for search queries. 
IMPORTANT: Do not call a tool unless it is absolutely necessary. If the user's question can be answered using the conversation history (e.g., they are asking about what was said earlier, what city was mentioned, etc.), you MUST answer it directly using that context. Do NOT call any tool in this case. Just reply with conversational text.`;

const messagesRecall = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: 'What is the current weather in Seattle?' },
  { role: 'assistant', content: 'The current weather in Seattle is clear with a temperature of 64°F.' },
  { role: 'user', content: 'What city did I just ask about?' }
];

const messagesSearch = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: 'What is the current weather in Seattle?' }
];

console.log('--- Testing Recall ---');
await test('llama-3.3-70b-versatile', messagesRecall);

console.log('--- Testing Search ---');
await test('llama-3.3-70b-versatile', messagesSearch);

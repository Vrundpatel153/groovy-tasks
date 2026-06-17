import { Groq, OpenAIAgent, FunctionTool } from "llamaindex";
import { z } from "zod";
import { 
  getShortTermMemory, 
  addShortTermMemory, 
  getLongTermMemory, 
  updateLongTermMemory 
} from "../utils/memoryStore.js";

// Helper calculator function
function runCalculator(operation, a, b) {
  switch (operation) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide': return b !== 0 ? a / b : 'Error: Division by zero';
    default: return 'Error: Invalid operation';
  }
}

// Helper web search via Tavily API
async function runWebSearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey === 'your-tavily-key') {
    return 'Error: Tavily API Key is not configured.';
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic'
      })
    });

    if (!response.ok) {
      return `Error from Tavily API: ${response.statusText}`;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return 'No search results found.';
    }

    return data.results
      .slice(0, 3)
      .map((r, i) => `[Result ${i+1}] Title: ${r.title}\nUrl: ${r.url}\nContent: ${r.content}`)
      .join('\n\n');
  } catch (error) {
    return `Error executing web search: ${error.message}`;
  }
}

export async function runAgent(message) {
  const usedTools = [];

  const llm = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.1-8b-instant",
  });

  const calculatorTool = FunctionTool.from(
    async ({ operation, a, b }) => {
      usedTools.push("calculator");
      return String(runCalculator(operation, a, b));
    },
    {
      name: "calculator",
      description: "Perform basic arithmetic calculations (add, subtract, multiply, divide).",
      parameters: z.object({
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
      }),
    }
  );

  const webSearchTool = FunctionTool.from(
    async ({ query }) => {
      usedTools.push("web_search");
      return await runWebSearch(query);
    },
    {
      name: "web_search",
      description: "Search the web using Tavily for up-to-date information, news, or general knowledge.",
      parameters: z.object({
        query: z.string(),
      }),
    }
  );

  const existingFacts = getLongTermMemory('llamaindex');
  const factsContext = existingFacts.length > 0
    ? `\nLong-term memory (known facts about the user):\n${existingFacts.map(f => `- ${f}`).join('\n')}`
    : '';

  const systemPrompt = `You are a helpful assistant with access to two tools: calculator and web_search. Call calculator for math operations, and call web_search for search queries. IMPORTANT: Do not call a tool unless it is absolutely necessary. If the user's question can be answered using the conversation history (e.g., they are asking about what was said earlier, what city was mentioned, etc.), you MUST answer it directly using that context. Do NOT call any tool in this case. Just reply with conversational text.${factsContext}`;

  const history = getShortTermMemory('llamaindex');
  const chatHistory = history.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  const agent = new OpenAIAgent({
    tools: [calculatorTool, webSearchTool],
    llm: llm,
    systemPrompt: systemPrompt
  });

  const response = await agent.chat({ message, chatHistory });
  const answer = response.message.content || '';

  // Update short-term memory
  addShortTermMemory('llamaindex', 'user', message);
  addShortTermMemory('llamaindex', 'assistant', answer);

  // Update long-term memory in background (non-blocking)
  updateLongTermMemory('llamaindex', message, answer).catch(err => 
    console.error('Long term memory extract error:', err)
  );

  return {
    answer,
    toolUsed: usedTools.length > 0 ? usedTools[0] : 'none'
  };
}

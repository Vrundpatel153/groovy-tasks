import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

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

  const model = new ChatOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    configuration: {
      baseURL: "https://api.groq.com/openai/v1",
    },
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

  const calculatorTool = tool(
    async ({ operation, a, b }) => {
      usedTools.push("calculator");
      return String(runCalculator(operation, a, b));
    },
    {
      name: "calculator",
      description: "Perform basic arithmetic calculations (add, subtract, multiply, divide).",
      schema: z.object({
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
      }),
    }
  );

  const webSearchTool = tool(
    async ({ query }) => {
      usedTools.push("web_search");
      return await runWebSearch(query);
    },
    {
      name: "web_search",
      description: "Search the web using Tavily for up-to-date information, news, or general knowledge.",
      schema: z.object({
        query: z.string(),
      }),
    }
  );

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are an intelligent, helpful agent with access to tools (calculator, web_search). Use tools whenever a user asks to calculate something or search the web for current events/information. Summarize the final results clearly."],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = await createToolCallingAgent({
    llm: model,
    tools: [calculatorTool, webSearchTool],
    prompt,
  });

  const executor = new AgentExecutor({
    agent,
    tools: [calculatorTool, webSearchTool],
  });

  const response = await executor.invoke({ input: message });

  return {
    answer: response.output || '',
    toolUsed: usedTools.length > 0 ? usedTools[0] : 'none'
  };
}

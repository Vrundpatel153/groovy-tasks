import OpenAI from "openai";

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
  const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
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
        name: 'search',
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

  const messages = [
    {
      role: 'system',
      content: 'You are an intelligent, helpful agent with access to tools (calculator, search). Do NOT wrap function calls in XML tags like <function=...> or output custom XML formatting. Instead, invoke the tools natively via the API. Use tools whenever a user asks to calculate something or search the web for current events/information. Summarize the final results clearly.'
    },
    { role: 'user', content: message }
  ];

  const usedTools = [];
  let loopCount = 0;
  const maxLoops = 5;

  while (loopCount < maxLoops) {
    const completion = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      tools: tools,
      tool_choice: 'auto'
    });

    const responseMessage = completion.choices[0].message;
    messages.push(responseMessage);

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        let toolResult = '';

        usedTools.push(toolName);

        if (toolName === 'calculator') {
          toolResult = runCalculator(toolArgs.operation, toolArgs.a, toolArgs.b);
        } else if (toolName === 'search') {
          toolResult = await runWebSearch(toolArgs.query);
        } else {
          toolResult = `Error: Tool '${toolName}' is not recognized.`;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: String(toolResult)
        });
      }
      loopCount++;
    } else {
      return {
        answer: responseMessage.content || '',
        toolUsed: usedTools.length > 0 ? usedTools[0] : 'none'
      };
    }
  }

  throw new Error('Agent loop exceeded maximum execution steps.');
}

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize OpenAI client for Groq
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Tool Definitions for the LLM
const tools = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform basic arithmetic operations: add, subtract, multiply, or divide two numbers.',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'The arithmetic operation to perform'
          },
          a: {
            type: 'number',
            description: 'The first number (operand a)'
          },
          b: {
            type: 'number',
            description: 'The second number (operand b)'
          }
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
          query: {
            type: 'string',
            description: 'The search query string'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'slack_notify',
      description: 'Send a notification or message to a Slack channel using a webhook.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message text to notify Slack channel'
          }
        },
        required: ['message']
      }
    }
  }
];

// Execute calculator operation
function runCalculator(operation, a, b) {
  switch (operation) {
    case 'add':
      return a + b;
    case 'subtract':
      return a - b;
    case 'multiply':
      return a * b;
    case 'divide':
      if (b === 0) return 'Error: Division by zero';
      return a / b;
    default:
      return 'Error: Invalid operation';
  }
}

// Execute web search via Tavily
async function runWebSearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey === 'your-tavily-key') {
    return 'Error: Tavily API Key is not configured. Please add TAVILY_API_KEY in the backend .env file.';
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
      const errorText = await response.text();
      return `Error from Tavily API: ${response.statusText} (${errorText})`;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return 'No search results found.';
    }

    // Format top search results for the LLM context
    const summary = data.results
      .slice(0, 4)
      .map((r, i) => `[${i+1}] Title: ${r.title}\nUrl: ${r.url}\nContent: ${r.content}`)
      .join('\n\n');

    return summary;
  } catch (error) {
    return `Error executing web search: ${error.message}`;
  }
}

// Execute Slack Notification
async function runSlackNotify(message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl === 'your-webhook-url') {
    return 'Error: Slack Webhook URL is not configured. Please add SLACK_WEBHOOK_URL in the backend .env file.';
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `Error posting to Slack: ${response.statusText} (${errorText})`;
    }

    return 'Slack notification sent successfully.';
  } catch (error) {
    return `Error executing slack notification: ${error.message}`;
  }
}

// Chat route with agent loop
app.post('/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const usedTools = [];
    const messages = [
      {
        role: 'system',
        content: 'You are an intelligent, helpful agent with access to tools (calculator, web_search, slack_notify). Use tools whenever a user asks to calculate something, search the web for current events/information, or notify Slack. Always summarize the final results clearly.'
      }
    ];

    // Append history to context (filtering out raw tool responses for clean session context)
    if (Array.isArray(history)) {
      history.forEach(item => {
        if (item.role === 'user' || item.role === 'assistant') {
          messages.push({ role: item.role, content: item.content });
        }
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    let loopCount = 0;
    const maxLoops = 6;

    while (loopCount < maxLoops) {
      const completion = await openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        tools: tools,
        tool_choice: 'auto'
      });

      const responseMessage = completion.choices[0].message;
      messages.push(responseMessage);

      // Check if LLM requested function execution
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          let toolResult = '';

          usedTools.push(toolName);

          if (toolName === 'calculator') {
            const { operation, a, b } = toolArgs;
            toolResult = runCalculator(operation, a, b);
          } else if (toolName === 'web_search') {
            toolResult = await runWebSearch(toolArgs.query);
          } else if (toolName === 'slack_notify') {
            toolResult = await runSlackNotify(toolArgs.message);
          } else {
            toolResult = `Error: Tool '${toolName}' is not recognized.`;
          }

          // Feed tool execution result back to the model
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: String(toolResult)
          });
        }
        loopCount++;
      } else {
        // No tool calls requested, model returned the final answer
        return res.json({
          answer: responseMessage.content || '',
          usedTools: Array.from(new Set(usedTools)) // deduplicated list of tool names used
        });
      }
    }

    // If limit is reached
    return res.status(500).json({
      error: 'Agent loop exceeded maximum execution steps without returning a final response.'
    });

  } catch (error) {
    console.error('Error in agent loop:', error);
    return res.status(500).json({ error: error.message || 'An error occurred during chat processing' });
  }
});

// Serve frontend build static files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all other GET requests to frontend entrypoint
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

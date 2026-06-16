const readline = require("node:readline");
const { stdin: input, stdout: output } = require("node:process");
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { CohereClient } = require("cohere-ai");
const fs = require("node:fs");

const providers = {
  gemini: {
    envKey: "GEMINI_API_KEY",
    label: "Gemini",
    chat: chatWithGemini,
  },
  cohere: {
    envKey: "COHERE_API_KEY",
    label: "Cohere",
    chat: chatWithCohere,
  },
  groq: {
    envKey: "GROQ_API_KEY",
    label: "Groq",
    chat: chatWithGroq,
  },
};

const tokenStats = {
  Gemini: { input: 0, output: 0 },
  Cohere: { input: 0, output: 0 },
  Groq: { input: 0, output: 0 },
};

const messages = [];

const rl = readline.createInterface({ input, output });
const color = {
  user: "\x1b[36m",
  assistant: "\x1b[32m",
  error: "\x1b[31m",
  info: "\x1b[90m",
  reset: "\x1b[0m",
};

function selectedProviderName() {
  const providerIndex = process.argv.indexOf("--provider");
  return providerIndex === -1 ? "gemini" : process.argv[providerIndex + 1]?.toLowerCase();
}

function prompt() {
  if (!rl.closed) rl.prompt();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn) {
  let attempt = 0;
  const maxAttempts = 5; // 1 initial + 4 retries
  const delays = [1000, 2000, 4000, 8000];

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      const status = error.status || error.statusCode || error.code || 500;
      const isRetryable = status === 429 || status >= 500 || error.code === 'ETIMEDOUT' || error.name === 'TimeoutError' || (typeof status === 'string' && status.includes('TIMEOUT'));
      
      if (!isRetryable || attempt === maxAttempts - 1) {
        throw error;
      }
      
      const jitter = Math.random() * 500;
      const delay = delays[attempt] + jitter;
      console.log(`\n${color.info}[Retry] Attempt ${attempt + 1} failed. Retrying in ${(delay / 1000).toFixed(2)}s...${color.reset}`);
      await sleep(delay);
      attempt++;
    }
  }
}

async function chatWithGemini(history, userMessage) {
  return await withRetry(async () => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const geminiHistory = history.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));
    geminiHistory.push({ role: "user", parts: [{ text: userMessage }] });
    
    const result = await model.generateContentStream({ contents: geminiHistory });

    let fullText = "";
    process.stdout.write(`${color.assistant}Gemini:${color.reset} `);
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      process.stdout.write(chunkText);
    }
    process.stdout.write("\n");
    
    const response = await result.response;
    const usage = response.usageMetadata;
    if (usage) {
      tokenStats.Gemini.input += usage.promptTokenCount || 0;
      tokenStats.Gemini.output += usage.candidatesTokenCount || 0;
    }
    return fullText;
  });
}

async function chatWithCohere(history, userMessage) {
  return await withRetry(async () => {
    const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
    
    const cohereHistory = history.map(m => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content
    }));

    const stream = await cohere.chatStream({
      model: "command-a-03-2025",
      message: userMessage,
      chatHistory: cohereHistory,
    });

    let fullText = "";
    process.stdout.write(`${color.assistant}Cohere:${color.reset} `);
    
    for await (const chatEvent of stream) {
      if (chatEvent.eventType === "text-generation") {
        fullText += chatEvent.text;
        process.stdout.write(chatEvent.text);
      } else if (chatEvent.eventType === "stream-end") {
        if (chatEvent.response && chatEvent.response.meta && chatEvent.response.meta.billedUnits) {
          tokenStats.Cohere.input += chatEvent.response.meta.billedUnits.inputTokens || 0;
          tokenStats.Cohere.output += chatEvent.response.meta.billedUnits.outputTokens || 0;
        }
      }
    }
    process.stdout.write("\n");
    return fullText;
  });
}

async function chatWithGroq(history, userMessage) {
  return await withRetry(async () => {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [...history, { role: "user", content: userMessage }],
      max_tokens: 1000,
      stream: true,
      stream_options: { include_usage: true }
    });

    let fullText = "";
    process.stdout.write(`${color.assistant}Groq:${color.reset} `);
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        fullText += chunk.choices[0].delta.content;
        process.stdout.write(chunk.choices[0].delta.content);
      }
      if (chunk.usage) {
        tokenStats.Groq.input += chunk.usage.prompt_tokens || 0;
        tokenStats.Groq.output += chunk.usage.completion_tokens || 0;
      }
    }
    process.stdout.write("\n");
    return fullText;
  });
}

function printStats() {
  console.log(`\n${color.info}Token Usage Summary:${color.reset}`);
  const tableData = Object.entries(tokenStats).map(([provider, stats]) => ({
    Provider: provider,
    "Input Tokens": stats.input,
    "Output Tokens": stats.output
  }));
  console.table(tableData);
  try {
    fs.writeFileSync("session-log.json", JSON.stringify(tokenStats, null, 2));
    console.log(`${color.info}Saved token usage to session-log.json${color.reset}`);
  } catch(e) {
    console.error(`Failed to write session-log.json: ${e.message}`);
  }
}

async function main() {
  const providerName = selectedProviderName();
  const provider = providers[providerName];

  if (!provider) {
    console.log(`${color.error}Error:${color.reset} Unknown provider "${providerName}". Use gemini, cohere, or groq.`);
    rl.close();
    process.exitCode = 1;
    return;
  }

  if (!process.env[provider.envKey]) {
    console.log(`${color.error}Error:${color.reset} Missing ${provider.envKey} for ${provider.label}.`);
    rl.close();
    process.exitCode = 1;
    return;
  }

  console.log(`${color.info}Provider: ${provider.label}${color.reset}`);
  console.log(`${color.info}Type "exit" or "quit" to end the chat.${color.reset}`);
  rl.setPrompt(`${color.user}You:${color.reset} `);
  prompt();

  for await (const line of rl) {
    const text = line.trim();

    if (["exit", "quit"].includes(text.toLowerCase())) {
      break;
    }

    if (!text) {
      prompt();
      continue;
    }

    try {
      const reply = await provider.chat(messages, text);
      messages.push({ role: "user", content: text });
      messages.push({ role: "assistant", content: reply });
    } catch (error) {
      const status = error.status ? ` (${error.status})` : "";
      const message = error.message || `Unable to reach ${provider.label}.`;
      console.log(`\n${color.error}Error:${color.reset} Request failed${status}: ${message}`);
    }

    prompt();
  }

  printStats();
  if (!rl.closed) rl.close();
  console.log(`${color.info}Goodbye!${color.reset}`);
}

main().catch((error) => {
  console.error(`\n${color.error}Unexpected error:${color.reset} ${error.message}`);
  printStats();
  if (!rl.closed) rl.close();
});

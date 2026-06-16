const readline = require("node:readline");
const { stdin: input, stdout: output } = require("node:process");
const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");

const providers = {
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    chat: chatWithAnthropic,
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    label: "OpenAI",
    chat: chatWithOpenAI,
  },
  groq: {
    envKey: "GROQ_API_KEY",
    label: "Groq",
    chat: chatWithGroq,
  },
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
  return providerIndex === -1 ? "anthropic" : process.argv[providerIndex + 1]?.toLowerCase();
}

function prompt() {
  if (!rl.closed) rl.prompt();
}

async function chatWithAnthropic(history, userMessage) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    messages: [...history, { role: "user", content: userMessage }],
  });

  return response.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

async function chatWithOpenAI(history, userMessage) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...history, { role: "user", content: userMessage }],
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

async function chatWithGroq(history, userMessage) {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [...history, { role: "user", content: userMessage }],
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

async function main() {
  const providerName = selectedProviderName();
  const provider = providers[providerName];

  if (!provider) {
    console.log(`${color.error}Error:${color.reset} Unknown provider "${providerName}". Use anthropic, openai, or groq.`);
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
      console.log(`${color.assistant}${provider.label}:${color.reset} ${reply}`);
    } catch (error) {
      const status = error.status ? ` (${error.status})` : "";
      const message = error.message || `Unable to reach ${provider.label}.`;
      console.log(`${color.error}Error:${color.reset} Request failed${status}: ${message}`);
    }

    prompt();
  }

  if (!rl.closed) rl.close();
  console.log(`${color.info}Goodbye!${color.reset}`);
}

main().catch((error) => {
  console.error(`${color.error}Unexpected error:${color.reset} ${error.message}`);
  if (!rl.closed) rl.close();
});

const readline = require("node:readline");
const { stdin: input, stdout: output } = require("node:process");
const Groq = require("groq-sdk");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const messages = [];
const rl = readline.createInterface({ input, output });
const color = {
  user: "\x1b[36m",
  assistant: "\x1b[32m",
  error: "\x1b[31m",
  info: "\x1b[90m",
  reset: "\x1b[0m",
};

function prompt() {
  if (!rl.closed) rl.prompt();
}

async function main() {
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

    messages.push({ role: "user", content: text });
    try {
      const completion = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 1000,
      });
      const reply = completion.choices[0]?.message?.content?.trim() || "";
      console.log(`${color.assistant}Groq:${color.reset} ${reply}`);
      messages.push({ role: "assistant", content: reply });
    } catch (error) {
      messages.pop();
      const status = error.status ? ` (${error.status})` : "";
      const message = error.message || "Unable to reach Groq.";
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

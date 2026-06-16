const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { logUsage } = require("./usage-logger");

const MODEL = "moonshotai/kimi-k2-instruct";
const INPUT_PER_MILLION = 1.0;
const OUTPUT_PER_MILLION = 3.0;
const CACHED_PER_MILLION = 0.25;
const MAX_CHARS = 40_000;
const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".html", ".css", ".scss",
  ".py", ".rb", ".go", ".rs", ".java", ".cs", ".php", ".sh", ".ps1", ".md", ".yml", ".yaml",
]);

if (!process.env.GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY.");
  process.exit(1);
}

const folderArg = process.argv[2];
if (!folderArg) {
  console.error("Usage: node explain-codebase.js <folder-path>");
  process.exit(1);
}

const root = path.resolve(folderArg);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error("Folder path not found.");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

function isBinary(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.includes(0);
}

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function usageOf(response) {
  const usage = response.usage || {};
  return {
    inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
    outputTokens: usage.completion_tokens || usage.output_tokens || 0,
    cachedTokens:
      usage.prompt_tokens_details?.cached_tokens ||
      usage.input_tokens_details?.cached_tokens ||
      usage.cached_tokens ||
      0,
  };
}

function costOf(usage) {
  const uncachedInput = Math.max(usage.inputTokens - usage.cachedTokens, 0);
  return (
    (uncachedInput * INPUT_PER_MILLION +
      usage.cachedTokens * CACHED_PER_MILLION +
      usage.outputTokens * OUTPUT_PER_MILLION) /
    1_000_000
  );
}

async function main() {
  let combined = "";
  let skipped = 0;

  for (const file of collectFiles(root)) {
    if (isBinary(file)) continue;
    const relative = path.relative(root, file);
    const block = `\n\n--- ${relative} ---\n${fs.readFileSync(file, "utf8")}`;
    if (combined.length + block.length > MAX_CHARS) {
      skipped += 1;
      continue;
    }
    combined += block;
  }

  if (skipped > 0) {
    console.warn(`Warning: skipped ${skipped} files after ~10K token cap.`);
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: "Explain the structure and purpose of the provided codebase clearly and concisely." },
      { role: "user", content: combined || "No readable code files found." },
    ],
  });

  const usage = usageOf(response);
  const cost = costOf(usage);
  logUsage("groq", MODEL, usage.inputTokens, usage.outputTokens, usage.cachedTokens, cost);
  console.log(response.choices[0]?.message?.content || "");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

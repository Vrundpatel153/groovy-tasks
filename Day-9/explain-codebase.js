const fs = require("fs");
const path = require("path");
const { logUsage } = require("./usage-logger");
const { requireGroqKey } = require("./load-env");
const { MODEL, createGroqClient, usageOf, costOf } = require("./api-utils");

const MAX_CHARS = 40_000;
const CODE_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".html", ".css", ".scss",
  ".py", ".rb", ".go", ".rs", ".java", ".cs", ".php", ".sh", ".ps1", ".md", ".yml", ".yaml",
]);

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

function buildCodebaseInput(root) {
  let combined = "";
  let skipped = 0;
  let included = 0;

  for (const file of collectFiles(root)) {
    if (isBinary(file)) continue;
    const relative = path.relative(root, file);
    const block = `\n\n--- ${relative} ---\n${fs.readFileSync(file, "utf8")}`;
    if (combined.length + block.length > MAX_CHARS) {
      skipped += 1;
      continue;
    }
    combined += block;
    included += 1;
  }

  return { combined, included, skipped };
}

async function explainCodebase(folderPath, options = {}) {
  requireGroqKey();
  const root = path.resolve(folderPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error("Folder path not found.");
  }

  const { combined, included, skipped } = buildCodebaseInput(root);
  console.log(`Reading: ${root}`);
  console.log(`Included files: ${included}`);
  if (skipped > 0) {
    console.warn(`Warning: skipped ${skipped} files after ~10K token cap.`);
  }

  const client = createGroqClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: "Explain the structure, purpose, entry points, and important files in the provided codebase. Keep it practical for a developer who wants to run or modify it." },
      { role: "user", content: combined || "No readable code files found." },
    ],
  });

  const usage = usageOf(response);
  const cost = costOf(usage);
  logUsage("groq", MODEL, usage.inputTokens, usage.outputTokens, usage.cachedTokens, cost);
  const result = response.choices[0]?.message?.content || "";
  if (options.print !== false) {
    console.log("");
    console.log(result);
    console.log("");
    console.log(`Logged usage. Cost: ${cost.toFixed(8)}`);
  }
  return { result, usage, cost };
}

if (require.main === module) {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error("Usage: node explain-codebase.js <folder-path>");
    process.exit(1);
  }

  explainCodebase(folderArg).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { explainCodebase };

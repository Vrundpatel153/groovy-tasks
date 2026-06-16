const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "usage-log.csv");

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

if (!fs.existsSync(LOG_FILE)) {
  console.log("No usage-log.csv found.");
  process.exit(0);
}

const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split(/\r?\n/).slice(1);
let inputTokens = 0;
let outputTokens = 0;
let cachedTokens = 0;
let totalCost = 0;

for (const line of lines) {
  if (!line) continue;
  const row = parseCsvLine(line);
  inputTokens += Number(row[3]) || 0;
  outputTokens += Number(row[4]) || 0;
  cachedTokens += Number(row[5]) || 0;
  totalCost += Number(row[6]) || 0;
}

const fullPriceInputCost = inputTokens * 1.0 / 1_000_000;
const cachedInputCost = (inputTokens - cachedTokens) * 1.0 / 1_000_000 + cachedTokens * 0.25 / 1_000_000;
const cacheSavings = fullPriceInputCost > 0
  ? ((fullPriceInputCost - cachedInputCost) / fullPriceInputCost) * 100
  : 0;

console.log(`Total Calls: ${lines.filter(Boolean).length}`);
console.log(`Input Tokens: ${inputTokens}`);
console.log(`Output Tokens: ${outputTokens}`);
console.log(`Cached Tokens: ${cachedTokens}`);
console.log(`Total Cost: ${totalCost.toFixed(8)}`);
console.log(`Cache Savings %: ${cacheSavings.toFixed(2)}`);

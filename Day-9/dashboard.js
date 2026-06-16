const fs = require("fs");
const path = require("path");
const { pricingFor } = require("./api-utils");

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

function getSummary() {
  if (!fs.existsSync(LOG_FILE)) {
    return {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalCost: 0,
      cacheSavings: 0,
    };
  }

  const content = fs.readFileSync(LOG_FILE, "utf8").trim();
  if (!content) {
    return {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalCost: 0,
      cacheSavings: 0,
    };
  }

  const lines = content.split(/\r?\n/).slice(1).filter(Boolean);
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let totalCost = 0;
  let fullPriceInputCost = 0;
  let cachedInputCost = 0;

  for (const line of lines) {
    const row = parseCsvLine(line);
    const model = row[2];
    const rowInputTokens = Number(row[3]) || 0;
    const rowOutputTokens = Number(row[4]) || 0;
    const rowCachedTokens = Number(row[5]) || 0;
    const pricing = pricingFor(model);

    inputTokens += rowInputTokens;
    outputTokens += rowOutputTokens;
    cachedTokens += rowCachedTokens;
    totalCost += Number(row[6]) || 0;
    fullPriceInputCost += rowInputTokens * pricing.inputPerMillion / 1_000_000;
    cachedInputCost +=
      (rowInputTokens - rowCachedTokens) * pricing.inputPerMillion / 1_000_000 +
      rowCachedTokens * pricing.cachedPerMillion / 1_000_000;
  }

  const cacheSavings = fullPriceInputCost > 0
    ? ((fullPriceInputCost - cachedInputCost) / fullPriceInputCost) * 100
    : 0;

  return {
    calls: lines.length,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalCost,
    cacheSavings,
  };
}

function printDashboard() {
  const summary = getSummary();
  if (summary.calls === 0) {
    console.log("No usage-log.csv data found yet. Run cache-test or explain-codebase first.");
    return summary;
  }

  console.log("");
  console.log("Usage Dashboard");
  console.log("---------------");
  console.log(`Total Calls: ${summary.calls}`);
  console.log(`Input Tokens: ${summary.inputTokens}`);
  console.log(`Output Tokens: ${summary.outputTokens}`);
  console.log(`Cached Tokens: ${summary.cachedTokens}`);
  console.log(`Total Cost: ${summary.totalCost.toFixed(8)}`);
  console.log(`Cache Savings %: ${summary.cacheSavings.toFixed(2)}`);
  return summary;
}

if (require.main === module) {
  printDashboard();
}

module.exports = { getSummary, printDashboard };

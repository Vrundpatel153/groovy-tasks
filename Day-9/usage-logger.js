const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "usage-log.csv");
const HEADER = "timestamp,provider,model,inputTokens,outputTokens,cachedTokens,cost\n";

function csv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function logUsage(provider, model, inputTokens, outputTokens, cachedTokens, cost) {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, HEADER);
  }

  const row = [
    new Date().toISOString(),
    provider,
    model,
    inputTokens,
    outputTokens,
    cachedTokens,
    cost.toFixed(8),
  ].map(csv).join(",");

  fs.appendFileSync(LOG_FILE, `${row}\n`);
}

module.exports = { logUsage };

const OpenAI = require("openai");

const MODEL = "moonshotai/kimi-k2-instruct";
const PRICING = {
  inputPerMillion: 1.0,
  outputPerMillion: 3.0,
  cachedPerMillion: 0.25,
};

function createGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
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
    raw: usage,
  };
}

function costOf(usage) {
  const uncachedInput = Math.max(usage.inputTokens - usage.cachedTokens, 0);
  return (
    (uncachedInput * PRICING.inputPerMillion +
      usage.cachedTokens * PRICING.cachedPerMillion +
      usage.outputTokens * PRICING.outputPerMillion) /
    1_000_000
  );
}

module.exports = { MODEL, PRICING, createGroqClient, usageOf, costOf };

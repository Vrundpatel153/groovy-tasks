const OpenAI = require("openai");

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const QUICK_TEST_MODEL = "llama-3.1-8b-instant";
const MODEL = process.env.GROQ_MODEL || DEFAULT_MODEL;
const PRICING_BY_MODEL = {
  "openai/gpt-oss-20b": {
    inputPerMillion: 0.075,
    outputPerMillion: 0.3,
    cachedPerMillion: 0.075,
  },
  "llama-3.1-8b-instant": {
    inputPerMillion: 0.05,
    outputPerMillion: 0.08,
    cachedPerMillion: 0.05,
  },
  "moonshotai/kimi-k2-instruct": {
    inputPerMillion: 1.0,
    outputPerMillion: 3.0,
    cachedPerMillion: 0.25,
  },
};

function pricingFor(model = MODEL) {
  return PRICING_BY_MODEL[model] || PRICING_BY_MODEL[DEFAULT_MODEL];
}

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

function costOf(usage, model = MODEL) {
  const pricing = pricingFor(model);
  const uncachedInput = Math.max(usage.inputTokens - usage.cachedTokens, 0);
  return (
    (uncachedInput * pricing.inputPerMillion +
      usage.cachedTokens * pricing.cachedPerMillion +
      usage.outputTokens * pricing.outputPerMillion) /
    1_000_000
  );
}

module.exports = {
  MODEL,
  DEFAULT_MODEL,
  QUICK_TEST_MODEL,
  PRICING_BY_MODEL,
  pricingFor,
  createGroqClient,
  usageOf,
  costOf,
};

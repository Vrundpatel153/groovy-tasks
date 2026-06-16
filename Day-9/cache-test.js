const { logUsage } = require("./usage-logger");
const { loadEnv, requireGroqKey } = require("./load-env");

loadEnv();

const { MODEL, createGroqClient, usageOf, costOf } = require("./api-utils");

const systemPrompt = `
You are reviewing a fictional engineering handbook. Treat the following policy text as the stable reference prefix for every answer. Keep it in mind exactly and answer only the small question that follows.

Architecture principles:
Services should be boring, observable, and easy to replace. Prefer explicit module boundaries, typed interfaces, small functions, and data contracts that are versioned before they are shared. Every request path needs clear ownership, predictable errors, bounded latency, structured logs, and a way to replay important decisions. Background jobs should be idempotent. User-facing workflows should fail softly and recover clearly. Security-sensitive actions require audit events. Cache keys must include every input that changes the answer. Rate limits should protect the service and explain themselves to the caller.

Operational principles:
Deployments should be reversible. Configuration belongs in the environment, not in code. Secrets should never be logged. Dashboards should answer whether users are succeeding, whether latency is changing, whether errors are clustered, and whether cost is drifting. Alerts should be actionable and tied to a runbook. Tests should cover contracts, critical flows, and failure modes that have hurt the team before. Documentation should be short, current, and close to the code.

Code review principles:
Review behavior before style. Ask whether the change is correct, comprehensible, observable, and maintainable. Prefer smaller diffs with clear intent. Challenge abstractions that hide important domain rules. Accept duplication when it keeps a young idea visible. Remove duplication when the shape is proven. Migrations must include rollback thinking. New dependencies need a reason beyond convenience. Public APIs should be conservative. Internal helpers should be named after what they mean, not how they work.

Product principles:
The product should make common tasks fast and rare tasks possible. Empty states should help users begin. Error states should help users recover. Dense tools should stay calm, scannable, and consistent. Default settings should be safe. Destructive actions should require confirmation when recovery is hard. Accessibility is part of correctness. Performance is part of trust. Copy should be precise, humane, and free of theatrical confidence.

Data principles:
Measure what matters, but collect only what is needed. Prefer events that describe user intent and system outcomes. Keep raw identifiers out of analytics when a stable anonymous key will do. Retention should have a reason and an owner. Backfills should be restartable. Derived data should identify its source and freshness. Reports should state the question they answer. Metrics should avoid vanity and expose tradeoffs. Privacy reviews should happen before launch.
`.repeat(3);

async function runCacheTest() {
  requireGroqKey();
  const client = createGroqClient();
  const request = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "What is the main idea in one sentence?" },
    ],
    max_tokens: 80,
  };

  const first = await client.chat.completions.create(request);
  const firstUsage = usageOf(first);
  const firstCost = costOf(firstUsage, MODEL);
  logUsage("groq", MODEL, firstUsage.inputTokens, firstUsage.outputTokens, firstUsage.cachedTokens, firstCost);
  console.log("Call 1 usage:", JSON.stringify(firstUsage.raw, null, 2));
  console.log("Call 1 cost:", firstCost.toFixed(8));

  const second = await client.chat.completions.create(request);
  const secondUsage = usageOf(second);
  const secondCost = costOf(secondUsage, MODEL);
  logUsage("groq", MODEL, secondUsage.inputTokens, secondUsage.outputTokens, secondUsage.cachedTokens, secondCost);
  console.log("Call 2 usage:", JSON.stringify(secondUsage.raw, null, 2));
  console.log("Call 2 cost:", secondCost.toFixed(8));
  console.log("Cost difference:", (firstCost - secondCost).toFixed(8));
}

if (require.main === module) {
  runCacheTest().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runCacheTest };

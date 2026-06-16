# Day-9: Groq Usage Logger CLI

Node.js CLI scripts that use the Groq OpenAI-compatible API with the `moonshotai/kimi-k2-instruct` model.

## Files

- `cache-test.js` - makes exactly two sequential Groq calls with the same long prompt prefix and prints usage, cached-token fields, and cost difference.
- `explain-codebase.js` - accepts a folder path, reads code files up to about 40K characters, and asks Groq to explain the codebase structure.
- `usage-logger.js` - shared CSV logger that appends usage rows to `usage-log.csv`.
- `dashboard.js` - reads `usage-log.csv` and prints total calls, tokens, cost, and cache savings percentage.

## Setup

Install the OpenAI SDK:

```powershell
npm install openai
```

Set your Groq key before running the API scripts:

```powershell
$env:GROQ_API_KEY="your_groq_api_key"
```

Or put it in `.env` and run with Node's env-file support:

```powershell
node --env-file=.env cache-test.js
```

The `.env` file should contain:

```env
GROQ_API_KEY=your_groq_api_key
```

## Test

Run syntax checks without making API calls:

```powershell
node --check cache-test.js
node --check explain-codebase.js
node --check usage-logger.js
node --check dashboard.js
```

Confirm the missing-key guard exits cleanly:

```powershell
node cache-test.js
node explain-codebase.js .
```

## Run

Run the cache test:

```powershell
node cache-test.js
```

Explain a folder:

```powershell
node explain-codebase.js ../Day-8
```

View usage totals after one or more API calls:

```powershell
node dashboard.js
```

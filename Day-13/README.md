# Day 13: Tool-Using AI Agent with React UI
<video src="multi tool agent.mp4" width="100%" controls></video>

A tool-using AI agent with a web interface. The backend uses the **Groq API** (via OpenAI SDK and `llama-3.3-70b-versatile` model) to run an agentic tool-calling loop, and serves a modern, responsive React frontend.

---

## 🛠️ Tools Available to the Agent

1. **Calculator (`calculator`)**
   - **Functions**: `add`, `subtract`, `multiply`, `divide`.
   - **Implementation**: Pure JavaScript logic on the server, running without external APIs.
2. **Web Search (`web_search`)**
   - **Implementation**: Integrates with the **Tavily API** to retrieve search results and feed top summaries back to the LLM.
3. **Slack Notifications (`slack_notify`)**
   - **Implementation**: Sends direct text alerts to a designated channel via a **Slack Incoming Webhook URL**.

---

## 🔑 Environment Variables Needed

Create or modify the `.env` file in the root of the project:

```env
GROQ_API_KEY=gsk_...
TAVILY_API_KEY=tvly-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Where to Get Each Key:
- **`GROQ_API_KEY`**: Register/login at [Groq Console](https://console.groq.com/) and generate an API key under **API Keys**.
- **`TAVILY_API_KEY`**: Sign up for a free tier account at [Tavily AI](https://tavily.com/) and copy your API key from the dashboard.
- **`SLACK_WEBHOOK_URL`**: Go to your Slack Workspace App Directory, create a custom App (or select an existing one), enable **Incoming Webhooks**, and click **Add New Webhook to Workspace** to generate a URL for your desired channel.

---

## 🚀 Run Steps

Follow these simple commands to start the application:

### 1. Install Dependencies
Installs both the Express backend and React build dependencies:
```bash
npm install
```

### 2. Build the Frontend
Compile the Vite React client into static production assets:
```bash
npm run build
```

### 3. Start the Server
Launch the Node/Express backend on port `5000`:
```bash
npm start
```

### 4. Open in Browser
Open your browser and navigate to:
```
http://localhost:5000
```

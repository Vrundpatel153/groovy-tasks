import React, { useState } from 'react';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [framework, setFramework] = useState('pure-sdk');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRun = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const targetEndpoint = `/${framework}`;

    try {
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: input.trim() })
      });

      if (!response.ok) {
        throw new Error(`Agent run failed with status: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during execution.');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    { text: 'Calculate: 375 * 45', label: 'Calculator' },
    { text: 'Search: current weather in Seattle', label: 'Web Search' },
    { text: 'What are the main states of water?', label: 'General Knowledge' }
  ];

  return (
    <div className="container">
      <header className="header">
        <span className="logo-emoji">⚡</span>
        <h1>Agent Framework Comparison</h1>
        <p className="subtitle">Evaluate Pure SDK vs LangChain vs LlamaIndex agent setups using Groq & Tavily</p>
      </header>

      <main className="main-content">
        <section className="form-section">
          <form onSubmit={handleRun} className="agent-form">
            <div className="form-group">
              <label htmlFor="message-input">User Message</label>
              <input
                id="message-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or request a tool run..."
                disabled={loading}
              />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="framework-select">Framework Implementation</label>
                <select
                  id="framework-select"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  disabled={loading}
                >
                  <option value="pure-sdk">Pure SDK (Raw Loop)</option>
                  <option value="langchain">LangChain (AgentExecutor)</option>
                  <option value="llamaindex">LlamaIndex (OpenAIAgent)</option>
                </select>
              </div>

              <button type="submit" className="submit-btn" disabled={loading || !input.trim()}>
                {loading ? 'Running Agent...' : 'Execute Agent'}
              </button>
            </div>
          </form>

          <div className="suggestions">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setInput(s.text)}
                disabled={loading}
                className="suggestion-tag"
              >
                <span className="tag-label">{s.label}:</span> {s.text}
              </button>
            ))}
          </div>
        </section>

        {loading && (
          <section className="loading-card">
            <div className="spinner"></div>
            <p>Running agentic reasoning loop using {framework === 'pure-sdk' ? 'Pure SDK' : framework === 'langchain' ? 'LangChain' : 'LlamaIndex'}...</p>
          </section>
        )}

        {error && (
          <section className="error-card">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </section>
        )}

        {result && (
          <section className="result-card">
            <h2 className="result-title">Agent Execution Output</h2>
            
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Framework</span>
                <span className="meta-value text-capitalize">{framework.replace('-', ' ')}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tool Used</span>
                <span className={`meta-value badge badge-${result.toolUsed}`}>
                  {result.toolUsed === 'calculator' && '🧮 calculator'}
                  {result.toolUsed === 'web_search' && '🔍 web_search'}
                  {result.toolUsed === 'none' && '❌ none'}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Latency</span>
                <span className="meta-value latency-value">{result.latencyMs} ms</span>
              </div>
            </div>

            <div className="output-content">
              <h3>Answer</h3>
              <p className="answer-text">{result.answer}</p>
            </div>
          </section>
        )}

        <section className="info-panel">
          <h2>About the Implementations</h2>
          <div className="info-grid">
            <div className="info-card">
              <h3>Pure SDK (Raw Loop)</h3>
              <p>Zero-dependency framework integration. Uses direct Groq completions API with manual `tool_calls` checking, parameter parsing, and response feeding.</p>
            </div>
            <div className="info-card">
              <h3>LangChain</h3>
              <p>State-of-the-art LLM orchestrator. Standardizes prompts, history, and tools through abstractions like `createToolCallingAgent` and the `AgentExecutor` runtime.</p>
            </div>
            <div className="info-card">
              <h3>LlamaIndex</h3>
              <p>Advanced data framework. Interfaces agents directly with external tool schemas via the `tool` wrapper and executes loops utilizing `OpenAIAgent` and the core `Groq` LLM class.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

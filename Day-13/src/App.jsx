import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm an AI agent with access to a calculator, web search, and Slack notification tools. How can I help you today?",
      usedTools: []
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, loading]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to history
    const updatedHistory = [...history, { role: 'user', content: userMessage }];
    setHistory(updatedHistory);
    setLoading(true);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          history: updatedHistory
        })
      });

      if (!response.ok) {
        throw new Error('Server error: ' + response.statusText);
      }

      const data = await response.json();
      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          usedTools: data.usedTools || []
        }
      ]);
    } catch (error) {
      console.error(error);
      setHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error while communicating with the agent: ' + error.message,
          usedTools: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    { text: 'Calculate: 154 * 23.5', label: 'Calculator' },
    { text: 'Search: current CEO of Google', label: 'Web Search' },
    { text: 'Slack: Hello Team from Agent!', label: 'Slack Webhook' }
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <span className="logo-icon">🤖</span>
          <h1>Tool Agent</h1>
        </div>
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span>Agent Loop Active</span>
        </div>
      </header>

      <main className="chat-container">
        <div className="chat-history">
          {history.map((msg, index) => (
            <div key={index} className={`message-wrapper ${msg.role}`}>
              <div className={`message-bubble ${msg.role}`}>
                <div className="message-header">
                  {msg.role === 'user' ? 'You' : 'Agent'}
                </div>
                <div className="message-content">{msg.content}</div>
                {msg.usedTools && msg.usedTools.length > 0 && (
                  <div className="tool-badge-container">
                    <span className="tool-badge-label">Tools Used:</span>
                    {msg.usedTools.map(tool => (
                      <span key={tool} className={`tool-badge badge-${tool}`}>
                        {tool === 'calculator' && '🧮 calculator'}
                        {tool === 'web_search' && '🔍 web_search'}
                        {tool === 'slack_notify' && '💬 slack'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-wrapper assistant">
              <div className="message-bubble assistant loading">
                <div className="message-header">Agent</div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div className="thinking-text">Thinking & executing tools...</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {history.length <= 1 && (
          <div className="suggestions-container">
            <p className="suggestions-title">Try asking me one of these:</p>
            <div className="suggestions-grid">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(s.text)}
                  className="suggestion-btn"
                >
                  <span className="suggestion-label">{s.label}</span>
                  <span className="suggestion-text">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question or invoke a tool..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;

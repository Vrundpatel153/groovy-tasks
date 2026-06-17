import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Play, 
  Sparkles, 
  ListTodo, 
  Send, 
  History, 
  AlertCircle, 
  BookOpen, 
  CheckCircle2, 
  RefreshCw,
  Upload
} from 'lucide-react';

const API_BASE = 'http://localhost:5000';

const SAMPLE_TRANSCRIPT = `Sarah: Thanks everyone for joining. Let's align on the Q3 product launch. Dave, how is the development of the primary auth dashboard going?
Dave: Development is mostly complete, but we have some edge cases to resolve. I will finish debugging the MFA flow by Friday.
Sarah: Perfect. Mark, what about the landing page design? We need it ready for review.
Mark: The initial mockups are done. I'll share the final landing page designs on Figma by Tuesday, June 23rd.
Sarah: Great. I will prepare the marketing copy and launch email sequence by next Monday.
Dave: Will we need a new database migration for this?
Sarah: Yes, let's have Dave write the migration script by next Wednesday so we don't block the release.
Dave: Understood, I'll take care of that.
Sarah: Sounds like a plan. Let's sync again next Thursday. Thanks!`;

export default function App() {
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Results of the active summarization
  const [result, setResult] = useState(null);
  
  // Historical items
  const [history, setHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      if (!response.ok) throw new Error('Failed to fetch history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleLoadSample = () => {
    setTranscript(SAMPLE_TRANSCRIPT);
    setSelectedHistoryItem(null);
    setResult(null);
    setError(null);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      setError('Please upload a valid text (.txt) file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setTranscript(e.target.result);
      setSelectedHistoryItem(null);
      setResult(null);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read the uploaded file.');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSummarize = async () => {
    if (!transcript.trim()) {
      setError('Please paste or write a meeting transcript first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedHistoryItem(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error occurred');
      }

      const data = await response.json();
      setResult(data);
      // Refresh database history list
      await fetchHistory();
    } catch (err) {
      setError(err.message || 'An error occurred while generating summary.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectHistoryItem = (item) => {
    setSelectedHistoryItem(item);
    setResult(null); // Clear active results panel
    setTranscript(item.transcript); // Show transcript in the box
    setError(null);
  };

  // Helper to format date string
  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Select what to display in the result section
  const displaySummary = result?.summary || selectedHistoryItem?.summary;
  const displayActionItems = result?.actionItems || selectedHistoryItem?.actionItems;
  const displaySlackSent = result?.slackSent ?? selectedHistoryItem?.slackSent;
  const isViewingHistory = !!selectedHistoryItem;

  return (
    <div className="app-container">
      {/* Sidebar for History */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">
            <Sparkles size={20} color="#fff" />
          </div>
          <div className="logo-text">Briefly Agent</div>
        </div>

        <div className="history-list">
          <div className="history-title">Meeting History</div>
          {history.length === 0 ? (
            <div className="history-empty">
              <History size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p>No past summaries</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => selectHistoryItem(item)}
                className={`history-item ${selectedHistoryItem?.id === item.id ? 'active' : ''}`}
              >
                <div className="history-item-header">
                  <span className="history-date">{formatDate(item.timestamp)}</span>
                  {item.slackSent && (
                    <span className="history-slack-badge">Slack</span>
                  )}
                </div>
                <div className="history-snippet">
                  {item.summary || item.transcript}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        <header className="workspace-header">
          <div className="workspace-title">
            <h1>Meeting Summarizer</h1>
            <p>AI Agent powered by Llama 3.3 70B & Live Slack Webhook Integration</p>
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={fetchHistory}
            title="Refresh History"
          >
            <RefreshCw size={16} />
            Sync
          </button>
        </header>

        <div className="workspace-grid">
          {/* Left Column: Transcript input */}
          <div className="column">
            <div className="glass-card">
              <div className="card-title">
                <FileText size={18} color="#6366f1" />
                Meeting Transcript
              </div>
              
              <textarea
                className="transcript-textarea"
                placeholder="Paste your meeting notes or raw transcript here..."
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  if (selectedHistoryItem) {
                    setSelectedHistoryItem(null); // Reset detail view since text changed
                  }
                }}
              />

              {error && (
                <div className="error-alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="textarea-footer">
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleLoadSample}
                    disabled={isLoading}
                  >
                    <BookOpen size={16} />
                    Load Sample
                  </button>

                  <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
                    <Upload size={16} />
                    Upload .txt
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      disabled={isLoading}
                    />
                  </label>
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSummarize}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play size={16} fill="currentColor" />
                      Summarize & Dispatch
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Summarization Output */}
          <div className="column">
            <div className="glass-card" style={{ height: '100%', minHeight: '520px' }}>
              <div className="card-title">
                <ListTodo size={18} color="#a855f7" />
                Agent Results
              </div>

              {!displaySummary ? (
                <div className="results-placeholder">
                  <div className="placeholder-icon">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h3>No Output Generated Yet</h3>
                    <p style={{ fontSize: '0.875rem', marginTop: '6px' }}>
                      Enter a transcript and click "Summarize & Dispatch" to run the agent.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="results-content">
                  {isViewingHistory && (
                    <div className="history-detail-badge">
                      <History size={14} />
                      Viewing Historical Record ({formatDate(selectedHistoryItem.timestamp)})
                    </div>
                  )}

                  <div className="summary-card">
                    <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Executive Summary
                    </h4>
                    <p>{displaySummary}</p>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Action Items
                    </h4>
                    <div className="table-wrapper">
                      {displayActionItems && displayActionItems.length > 0 ? (
                        <table className="action-table">
                          <thead>
                            <tr>
                              <th>Task</th>
                              <th>Owner</th>
                              <th>Deadline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayActionItems.map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.task}</td>
                                <td className="owner-cell">{item.owner}</td>
                                <td className="deadline-cell">
                                  {item.deadline && item.deadline.toLowerCase() !== 'unspecified' ? (
                                    <span className="deadline-specified">{item.deadline}</span>
                                  ) : (
                                    <span className="deadline-unspecified">unspecified</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                          No action items detected.
                        </div>
                      )}
                    </div>
                  </div>

                  {displaySlackSent && (
                    <div className="slack-badge-container">
                      <div className="slack-success-badge">
                        <CheckCircle2 size={16} />
                        Dispatched to Slack Webhook
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

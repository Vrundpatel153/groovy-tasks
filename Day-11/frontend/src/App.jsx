import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  UploadCloud, 
  MessageSquare, 
  Trash2, 
  Sun, 
  Moon, 
  Search, 
  BookOpen, 
  Sparkles, 
  Send,
  Loader,
  Clock,
  Book,
  Coins,
  TrendingDown,
  Quote,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocText, setActiveDocText] = useState("");
  const [chats, setChats] = useState({}); // { [docId]: [ { sender: 'user'|'assistant', text: string, citations?: [], cost?: {} } ] }
  const [currentInput, setCurrentInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [theme, setTheme] = useState("light");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [uploadError, setUploadError] = useState(null);
  
  // State for active document's cost metrics dashboard
  const [dashboardCost, setDashboardCost] = useState(null);
  // State to track which citations are expanded in bubbles: { [messageIndex]: { [citationId]: boolean } }
  const [expandedCitations, setExpandedCitations] = useState({});

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const API_BASE = "http://localhost:5001/api";

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
    const savedTheme = localStorage.getItem("notes-theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  // Fetch full document text when active document changes
  useEffect(() => {
    if (activeDocId) {
      fetchDocText(activeDocId);
      // Reset active cost dashboard when changing notes
      setDashboardCost(null);
    } else {
      setActiveDocText("");
      setDashboardCost(null);
    }
  }, [activeDocId]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, isChatting]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("notes-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0 && !activeDocId) {
          setActiveDocId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch documents", e);
    }
  };

  const fetchDocText = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveDocText(data.text);
      }
    } catch (e) {
      console.error("Failed to fetch doc text", e);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to upload file.");
      }

      const data = await res.json();
      setDocuments(prev => [data.document, ...prev]);
      setActiveDocId(data.document.id);
    } catch (e) {
      console.error("Upload failed", e);
      setUploadError(e.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteDocument = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document from vector database?")) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
        if (activeDocId === id) {
          const remaining = documents.filter(doc => doc.id !== id);
          setActiveDocId(remaining.length > 0 ? remaining[0].id : null);
        }
        const newChats = { ...chats };
        delete newChats[id];
        setChats(newChats);
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!currentInput.trim() || !activeDocId || isChatting) return;

    const userMessageText = currentInput.trim();
    setCurrentInput("");

    const currentHistory = chats[activeDocId] || [];
    const updatedHistory = [...currentHistory, { sender: "user", text: userMessageText }];
    
    setChats(prev => ({
      ...prev,
      [activeDocId]: updatedHistory
    }));

    setIsChatting(true);

    // Add temporary assistant empty slot
    setChats(prev => ({
      ...prev,
      [activeDocId]: [...updatedHistory, { sender: "assistant", text: "", citations: [], cost: {} }]
    }));

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeDocId,
          message: userMessageText,
          history: currentHistory,
        }),
      });

      if (!response.ok) {
        throw new Error("RAG API Chat failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let streamedText = "";
      let citations = [];
      let costInfo = {};
      let firstChunkProcessed = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              
              // Handle initial citation & cost payload
              if (data.citations && data.cost) {
                citations = data.citations;
                costInfo = data.cost;
                setDashboardCost(data.cost);
                
                // Update assistant bubble with metadata
                setChats(prev => {
                  const docHistory = [...(prev[activeDocId] || [])];
                  if (docHistory.length > 0) {
                    docHistory[docHistory.length - 1] = {
                      ...docHistory[docHistory.length - 1],
                      citations: data.citations,
                      cost: data.cost
                    };
                  }
                  return { ...prev, [activeDocId]: docHistory };
                });
                continue;
              }

              // Handle streaming content tokens
              if (data.text) {
                streamedText += data.text;
                setChats(prev => {
                  const docHistory = [...(prev[activeDocId] || [])];
                  if (docHistory.length > 0) {
                    docHistory[docHistory.length - 1] = {
                      ...docHistory[docHistory.length - 1],
                      text: streamedText
                    };
                  }
                  return { ...prev, [activeDocId]: docHistory };
                });
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (err) {
              console.error("Stream parse error", err);
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming error", error);
      setChats(prev => {
        const docHistory = [...(prev[activeDocId] || [])];
        if (docHistory.length > 0) {
          docHistory[docHistory.length - 1] = {
            sender: "assistant",
            text: `⚠️ Error: ${error.message || "Failed to retrieve from local ChromaDB/Groq server."}`,
            citations: []
          };
        }
        return { ...prev, [activeDocId]: docHistory };
      });
    } finally {
      setIsChatting(false);
    }
  };

  const toggleCitation = (msgIndex, citIndex) => {
    setExpandedCitations(prev => {
      const msgState = prev[msgIndex] || {};
      return {
        ...prev,
        [msgIndex]: {
          ...msgState,
          [citIndex]: !msgState[citIndex]
        }
      };
    });
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const getHighlightedText = (text, highlight) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi"));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} style={{ backgroundColor: "rgba(176, 92, 60, 0.25)", color: "inherit", padding: "0 2px", borderRadius: "2px" }}>{part}</mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const activeDoc = documents.find(d => d.id === activeDocId);
  const activeChat = chats[activeDocId] || [];

  return (
    <div className="app-container">
      {/* Sidebar: Notes Navigation */}
      <aside className="sidebar">
        <div className="panel-header" style={{ borderRight: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px", borderRadius: "10px", backgroundColor: "var(--text-accent)", color: "#fff" }}>
              <BookOpen size={20} />
            </div>
            <span className="card-title" style={{ fontWeight: "700" }}>AskMyNotes RAG</span>
          </div>
          <button onClick={toggleTheme} className="btn btn-secondary btn-icon" title="Toggle Theme">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        {/* Note Search Box */}
        <div style={{ padding: "16px 20px 8px 20px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Search vector store..." 
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="text-input"
              style={{ paddingLeft: "36px" }}
            />
          </div>
        </div>

        {/* Notes list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>
            Vector Documents ({filteredDocs.length})
          </span>
          
          {filteredDocs.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              No documents embedded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {filteredDocs.map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: doc.id === activeDocId ? "var(--bg-active)" : "transparent",
                    border: doc.id === activeDocId ? "1px solid var(--border-color)" : "1px solid transparent",
                    cursor: "pointer"
                  }}
                  className="note-item"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden", flex: 1 }}>
                    <FileText size={18} style={{ color: doc.id === activeDocId ? "var(--text-accent)" : "var(--text-muted)", flexShrink: 0 }} />
                    <div style={{ overflow: "hidden" }}>
                      <p style={{ fontSize: "0.9rem", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-main)" }}>
                        {doc.name}
                      </p>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {doc.pages} pages • {formatSize(doc.size)}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => deleteDocument(doc.id, e)} 
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
                    title="Delete document and clear vectors"
                  >
                    <Trash2 size={14} className="hover-red" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Analytics dashboard card */}
        {dashboardCost && (
          <div style={{ padding: "0 20px 10px 20px" }}>
            <div className="cost-card">
              <div className="cost-header">
                <Coins size={16} style={{ color: "var(--text-accent)" }} />
                <span>RAG vs Full-Doc Cost Comparison</span>
              </div>
              
              <div className="cost-row">
                <span style={{ color: "var(--text-muted)" }}>Full-Doc Tokens:</span>
                <span className="cost-value red">{dashboardCost.fullDocTokens.toLocaleString()}</span>
              </div>
              <div className="cost-row">
                <span style={{ color: "var(--text-muted)" }}>Full-Doc Cost:</span>
                <span className="cost-value red">${dashboardCost.fullDocCostUSD.toFixed(5)}</span>
              </div>
              
              <div style={{ borderTop: "1px dashed var(--border-color)", margin: "8px 0" }}></div>
              
              <div className="cost-row">
                <span style={{ color: "var(--text-main)", fontWeight: "500" }}>RAG Tokens (Top 3):</span>
                <span className="cost-value green">{dashboardCost.ragTokens.toLocaleString()}</span>
              </div>
              <div className="cost-row">
                <span style={{ color: "var(--text-main)", fontWeight: "500" }}>RAG Cost (Top 3):</span>
                <span className="cost-value green">${dashboardCost.ragCostUSD.toFixed(5)}</span>
              </div>

              <div className="savings-banner">
                <TrendingDown size={14} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                {dashboardCost.savingsPercent}% lower LLM cost!
              </div>
            </div>
          </div>
        )}

        {/* Upload Button area */}
        <div style={{ padding: "20px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            style={{ display: "none" }} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isUploading}
            className="btn btn-primary"
            style={{ width: "100%", height: "46px" }}
          >
            {isUploading ? (
              <>
                <Loader size={18} className="pulse" style={{ animation: "spin 2s linear infinite" }} />
                <span>Chunking & Indexing...</span>
              </>
            ) : (
              <>
                <UploadCloud size={18} />
                <span>Embed PDF Note (RAG)</span>
              </>
            )}
          </button>
          {uploadError && (
            <p style={{ color: "red", fontSize: "0.8rem", marginTop: "8px", textAlign: "center" }}>
              {uploadError}
            </p>
          )}
        </div>
      </aside>

      {/* Main split dashboard */}
      <main className="main-content">
        {/* Left Panel: Document Text View */}
        <section className="preview-panel">
          <div className="panel-header">
            <span className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Book size={18} style={{ color: "var(--text-accent)" }} />
              Document Reader
            </span>
            {activeDoc && (
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={12} /> {activeDoc.readingTime} min read
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sparkles size={12} /> {activeDoc.wordCount} words
                </span>
              </div>
            )}
          </div>

          {activeDoc ? (
            <>
              {/* Document Text Filter */}
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-app)", display: "flex", gap: "10px", alignItems: "center" }}>
                <Search size={14} style={{ color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Find in document..." 
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="text-input"
                  style={{ border: "none", padding: "4px 8px", backgroundColor: "transparent", fontSize: "0.85rem" }}
                />
              </div>

              {/* Text Container */}
              <div 
                className="notebook-paper" 
                style={{ 
                  flex: 1, 
                  overflowY: "auto", 
                  padding: "40px", 
                  fontFamily: "var(--font-serif)", 
                  fontSize: "1.1rem", 
                  lineHeight: "1.7", 
                  color: "var(--text-main)",
                  whiteSpace: "pre-wrap"
                }}
              >
                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", marginBottom: "20px", fontWeight: "600" }}>
                  {activeDoc.name.replace(".pdf", "")}
                </h1>
                <hr style={{ border: "none", borderTop: "2px solid var(--text-accent)", width: "60px", marginBottom: "30px" }} />
                <p>
                  {getHighlightedText(activeDocText, docSearch)}
                </p>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                <FileText size={32} />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "600", color: "var(--text-main)", marginBottom: "8px" }}>No document selected</h3>
              <p style={{ maxWidth: "280px", fontSize: "0.9rem" }}>Upload and embed a PDF note to start parsing and retrieval.</p>
            </div>
          )}
        </section>

        {/* Right Panel: Chat Assistant */}
        <section className="chat-panel">
          <div className="panel-header">
            <span className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={18} style={{ color: "var(--text-accent)" }} />
              Chat Assistant (RAG)
            </span>
            {activeDoc && (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Retrieving: {activeDoc.name}
              </span>
            )}
          </div>

          {/* Chat scroll workspace */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-app)" }}>
            {activeDoc ? (
              activeChat.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  <div style={{ padding: "16px", borderRadius: "50%", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", marginBottom: "16px", color: "var(--text-accent)" }}>
                    <Sparkles size={28} />
                  </div>
                  <h4 style={{ color: "var(--text-main)", fontWeight: "600", fontSize: "1.05rem", marginBottom: "6px" }}>Ask questions via RAG</h4>
                  <p style={{ fontSize: "0.9rem", maxWidth: "300px" }}>
                    The backend retrieves the top 3 relevant chunks from ChromaDB and cites them. Try asking a detailed query!
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activeChat.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`bubble ${msg.sender}`}
                      style={{
                        whiteSpace: "pre-wrap",
                        display: "flex",
                        flexDirection: "column"
                      }}
                    >
                      <span>{msg.text}</span>
                      
                      {/* Citations Renderer */}
                      {msg.sender === "assistant" && msg.citations && msg.citations.length > 0 && (
                        <div className="citation-container">
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "600", marginBottom: "6px", color: "var(--text-main)" }}>
                            <Quote size={12} />
                            <span>Retrieved Context Sources:</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {msg.citations.map((citation, citIdx) => {
                              const isExpanded = expandedCitations[index]?.[citIdx];
                              return (
                                <div key={citIdx} style={{ width: "100%" }}>
                                  <button 
                                    type="button"
                                    onClick={() => toggleCitation(index, citIdx)}
                                    className="citation-badge"
                                    style={{ border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "4px", margin: "2px 0" }}
                                  >
                                    <span>Source Chunk {citation.index + 1}</span>
                                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                  </button>
                                  {isExpanded && (
                                    <div 
                                      style={{ 
                                        padding: "10px", 
                                        backgroundColor: "var(--bg-card)", 
                                        borderRadius: "6px", 
                                        border: "1px solid var(--border-color)", 
                                        marginTop: "4px",
                                        marginBottom: "6px",
                                        fontFamily: "var(--font-serif)",
                                        lineHeight: "1.4",
                                        fontSize: "0.85rem",
                                        color: "var(--text-main)",
                                        whiteSpace: "pre-wrap"
                                      }}
                                    >
                                      {citation.text}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatting && activeChat[activeChat.length - 1]?.text === "" && (
                    <div className="bubble assistant pulse">Retrieving source vectors & typing...</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-muted)" }}>
                <MessageSquare size={32} style={{ marginBottom: "16px" }} />
                <p style={{ fontSize: "0.9rem" }}>Please select or embed a PDF document to open the chat portal.</p>
              </div>
            )}
          </div>

          {/* Chat Input form */}
          <div style={{ padding: "20px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
            <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "10px" }}>
              <input 
                type="text" 
                placeholder={activeDoc ? "Ask a question about this note..." : "Embed a note to chat"} 
                disabled={!activeDoc}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                className="text-input"
                style={{ height: "46px" }}
              />
              <button 
                type="submit" 
                disabled={!activeDoc || !currentInput.trim() || isChatting}
                className="btn btn-primary btn-icon"
                style={{ width: "46px", height: "46px", borderRadius: "var(--radius-sm)", flexShrink: 0 }}
              >
                {isChatting ? <Loader size={18} className="pulse" style={{ animation: "spin 2s linear infinite" }} /> : <Send size={18} />}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

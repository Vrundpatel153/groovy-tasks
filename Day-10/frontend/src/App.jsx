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
  Maximize2
} from "lucide-react";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocText, setActiveDocText] = useState("");
  const [chats, setChats] = useState({}); // { [docId]: [ { sender: 'user'|'assistant', text: string } ] }
  const [currentInput, setCurrentInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [theme, setTheme] = useState("light");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [uploadError, setUploadError] = useState(null);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const API_BASE = "http://localhost:5000/api";

  // Load documents on mount
  useEffect(() => {
    fetchDocuments();
    // Load local storage theme
    const savedTheme = localStorage.getItem("notes-theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  // Fetch full document text when active document changes
  useEffect(() => {
    if (activeDocId) {
      fetchDocText(activeDocId);
    } else {
      setActiveDocText("");
    }
  }, [activeDocId]);

  // Scroll to bottom of chat when history changes or when streaming
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
      setUploadError("Only PDF documents are supported.");
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
    if (!confirm("Are you sure you want to delete this document?")) return;

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
        // Delete chat history for this doc
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

    // Initialize/retrieve chat history for current doc
    const currentHistory = chats[activeDocId] || [];
    const updatedHistory = [...currentHistory, { sender: "user", text: userMessageText }];
    
    // Add user message to state
    setChats(prev => ({
      ...prev,
      [activeDocId]: updatedHistory
    }));

    setIsChatting(true);

    // Add temporary empty assistant message for streaming
    setChats(prev => ({
      ...prev,
      [activeDocId]: [...updatedHistory, { sender: "assistant", text: "" }]
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
        throw new Error("API request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedResponse = "";

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
              if (data.text) {
                streamedResponse += data.text;
                // Update assistant's last message stream in real-time
                setChats(prev => {
                  const docHistory = [...(prev[activeDocId] || [])];
                  if (docHistory.length > 0) {
                    docHistory[docHistory.length - 1] = {
                      sender: "assistant",
                      text: streamedResponse
                    };
                  }
                  return { ...prev, [activeDocId]: docHistory };
                });
              } else if (data.error) {
                throw new Error(data.error);
              }
            } catch (err) {
              console.error("Error parsing stream line", err);
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
            text: `⚠️ Error: ${error.message || "Failed to communicate with AI server. Please make sure the Groq API key is valid."}`
          };
        }
        return { ...prev, [activeDocId]: docHistory };
      });
    } finally {
      setIsChatting(false);
    }
  };

  // Helper to format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Filter documents in sidebar search
  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  // Helper to highlight matching search term in parsed document preview
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
            <span className="card-title" style={{ fontWeight: "700" }}>AskMyNotes</span>
          </div>
          <button onClick={toggleTheme} className="btn btn-secondary btn-icon" title="Toggle Theme">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        {/* Sidebar Search */}
        <div style={{ padding: "16px 20px 8px 20px" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Search your notes..." 
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
            My Documents ({filteredDocs.length})
          </span>
          
          {filteredDocs.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              No documents found
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
                    title="Delete Note"
                  >
                    <Trash2 size={14} className="hover-red" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                <span>Extracting Text...</span>
              </>
            ) : (
              <>
                <UploadCloud size={18} />
                <span>Upload PDF Note</span>
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
                  placeholder="Find in text..." 
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
              <p style={{ maxWidth: "280px", fontSize: "0.9rem" }}>Upload a PDF note in the sidebar to start reading and querying.</p>
            </div>
          )}
        </section>

        {/* Right Panel: Chat Assistant */}
        <section className="chat-panel">
          <div className="panel-header">
            <span className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={18} style={{ color: "var(--text-accent)" }} />
              Chat Assistant
            </span>
            {activeDoc && (
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Querying: {activeDoc.name}
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
                  <h4 style={{ color: "var(--text-main)", fontWeight: "600", fontSize: "1.05rem", marginBottom: "6px" }}>Ask anything about your notes</h4>
                  <p style={{ fontSize: "0.9rem", maxWidth: "300px" }}>
                    "What are the main key points of this note?" or "Summarize section 2"
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activeChat.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`bubble ${msg.sender}`}
                      style={{
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isChatting && activeChat[activeChat.length - 1]?.text === "" && (
                    <div className="bubble assistant pulse">Typing...</div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text-muted)" }}>
                <MessageSquare size={32} style={{ marginBottom: "16px" }} />
                <p style={{ fontSize: "0.9rem" }}>Please select or upload a document to open the chat portal.</p>
              </div>
            )}
          </div>

          {/* Chat Input form */}
          <div style={{ padding: "20px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
            <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "10px" }}>
              <input 
                type="text" 
                placeholder={activeDoc ? "Ask a question about this note..." : "Upload a note to chat"} 
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

// Global State
let documentText = '';
let currentStrategy = 'fixed';
let datasetQueries = [];

// DOM Elements
const docWords = document.getElementById('doc-words');
const docChars = document.getElementById('doc-chars');
const docSentences = document.getElementById('doc-sentences');
const btnViewDoc = document.getElementById('btn-view-doc');

const strategyTabs = document.querySelectorAll('.sidebar-section .tabs-buttons .tab-btn');
const strategyDesc = document.getElementById('strategy-desc');
const paramGroups = document.querySelectorAll('.param-group');
const btnGenerateChunks = document.getElementById('btn-generate-chunks');

const navTabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

const valTotalChunks = document.getElementById('val-total-chunks');
const visualizerContent = document.getElementById('visualizer-content');

const searchQueryInput = document.getElementById('search-query-input');
const btnRunSearch = document.getElementById('btn-run-search');
const suggestionTags = document.querySelectorAll('.suggestion-tag');
const searchResultsGrid = document.getElementById('search-results-grid');
const searchEmptyState = document.getElementById('search-empty-state');
const resultsPreRerank = document.getElementById('results-pre-rerank');
const resultsPostRerank = document.getElementById('results-post-rerank');

const btnReRunEval = document.getElementById('btn-re-run-eval');
const evalLoader = document.getElementById('eval-loader');
const evalProgressBar = document.getElementById('eval-progress-bar');
const evalLog = document.getElementById('eval-log');
const evalDashboardContent = document.getElementById('eval-dashboard-content');
const evalTableBody = document.getElementById('eval-table-body');

const bestHitPre = document.getElementById('best-hit-pre');
const bestHitPreStrat = document.getElementById('best-hit-pre-strat');
const bestHitPost = document.getElementById('best-hit-post');
const bestHitPostStrat = document.getElementById('best-hit-post-strat');
const bestMrr = document.getElementById('best-mrr');
const bestMrrStrat = document.getElementById('best-mrr-strat');

const chartHitRate = document.getElementById('chart-hit-rate');
const chartMrr = document.getElementById('chart-mrr');

const modalViewDoc = document.getElementById('modal-view-doc');
const modalCloseDoc = document.getElementById('modal-close-doc');
const modalDocContent = document.getElementById('modal-doc-content');

// Strategy Info Mapping
const strategyInfo = {
  fixed: "<strong>Fixed-Size Chunks</strong>: Splits text into equal word blocks with a fixed overlap. Computationally fast, but ignores natural sentence boundaries.",
  sliding: "<strong>Sliding Window Chunks</strong>: A token-based sliding window that moves by a set step size. Highly redundant overlap ensures sentences are rarely cut out of context.",
  semantic: "<strong>Semantic Chunks</strong>: Splits text into sentences and groups them. Sentence boundaries are created where embedding vector similarity drops below the threshold, signifying a topic shift.",
  hierarchical: "<strong>Hierarchical (Parent-Child)</strong>: Documents are split into large parent chunks, which are subdivided into small child chunks. Searches match child chunks but retrieve the larger parents."
};

// Initialize app
async function init() {
  // Init Lucide Icons
  lucide.createIcons();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load initial document data
  await loadDocumentData();
  
  // Automatically generate default chunks (Fixed)
  triggerChunkGeneration();
  
  // Load evaluation results (loads from cache file if available)
  loadEvaluation(false);
}

// Event Listeners setup
function setupEventListeners() {
  // Document modal toggle
  btnViewDoc.addEventListener('click', () => {
    modalDocContent.textContent = documentText;
    modalViewDoc.style.display = 'flex';
  });
  
  modalCloseDoc.addEventListener('click', () => {
    modalViewDoc.style.display = 'none';
  });
  
  modalViewDoc.addEventListener('click', (e) => {
    if (e.target === modalViewDoc) modalViewDoc.style.display = 'none';
  });
  
  // Sidebar Strategy Tabs
  strategyTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      strategyTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const strategy = tab.getAttribute('data-strategy');
      currentStrategy = strategy;
      
      // Update Desc
      strategyDesc.innerHTML = strategyInfo[strategy];
      
      // Update parameters visibility
      paramGroups.forEach(g => {
        if (g.getAttribute('data-strategy-param') === strategy) {
          g.classList.add('active');
        } else {
          g.classList.remove('active');
        }
      });
    });
  });
  
  // Slider values live updates
  const sliders = [
    { id: 'param-fixed-size', valId: 'val-fixed-size' },
    { id: 'param-fixed-overlap', valId: 'val-fixed-overlap' },
    { id: 'param-sliding-window', valId: 'val-sliding-window' },
    { id: 'param-sliding-step', valId: 'val-sliding-step' },
    { id: 'param-semantic-threshold', valId: 'val-semantic-threshold' },
    { id: 'param-parent-size', valId: 'val-parent-size' },
    { id: 'param-parent-overlap', valId: 'val-parent-overlap' },
    { id: 'param-child-size', valId: 'val-child-size' },
    { id: 'param-child-overlap', valId: 'val-child-overlap' }
  ];
  
  sliders.forEach(s => {
    const el = document.getElementById(s.id);
    const valEl = document.getElementById(s.valId);
    if (el && valEl) {
      el.addEventListener('input', () => {
        valEl.textContent = el.value;
      });
    }
  });
  
  // Generate Chunks button
  btnGenerateChunks.addEventListener('click', triggerChunkGeneration);
  
  // Main Tab navigation
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabName = tab.getAttribute('data-tab');
      tabPanes.forEach(pane => {
        if (pane.id === `tab-${tabName}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });
  
  // Search suggestions
  suggestionTags.forEach(tag => {
    tag.addEventListener('click', () => {
      searchQueryInput.value = tag.getAttribute('data-query');
      triggerSearch();
    });
  });
  
  // Search submit
  btnRunSearch.addEventListener('click', triggerSearch);
  searchQueryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') triggerSearch();
  });
  
  // Evaluation Run Buttons
  btnReRunEval.addEventListener('click', () => {
    loadEvaluation(true);
  });
}

// Fetch document and initial stats
async function loadDocumentData() {
  try {
    const res = await fetch('/api/document');
    if (!res.ok) throw new Error("Could not load document");
    const data = await res.json();
    
    documentText = data.documentText;
    datasetQueries = data.queries;
    
    // Compute stats
    const words = documentText.trim().split(/\s+/).length;
    const chars = documentText.length;
    
    // Sentence splitter (approximate)
    const sentenceBoundary = /(?<!\b(?:e\.g|i\.e|FAIR|AI|LLM|LLMs|FAISS|ChromaDB|Milvus|Qdrant|Dr|Mr|Ms|v3|v3\.0|No|Vol)\.)(?<=[.!?])\s+/gi;
    const sentences = documentText.split(sentenceBoundary).filter(s => s.trim().length > 0).length;
    
    docWords.textContent = words.toLocaleString();
    docChars.textContent = chars.toLocaleString();
    docSentences.textContent = sentences.toLocaleString();
  } catch (error) {
    console.error("Error loading document data:", error);
  }
}

// Get parameters based on strategy
function getParams() {
  if (currentStrategy === 'fixed') {
    return {
      chunkSize: parseInt(document.getElementById('param-fixed-size').value),
      chunkOverlap: parseInt(document.getElementById('param-fixed-overlap').value)
    };
  } else if (currentStrategy === 'sliding') {
    return {
      windowSize: parseInt(document.getElementById('param-sliding-window').value),
      stepSize: parseInt(document.getElementById('param-sliding-step').value)
    };
  } else if (currentStrategy === 'semantic') {
    return {
      percentileThreshold: parseInt(document.getElementById('param-semantic-threshold').value)
    };
  } else if (currentStrategy === 'hierarchical') {
    return {
      parentSize: parseInt(document.getElementById('param-parent-size').value),
      parentOverlap: parseInt(document.getElementById('param-parent-overlap').value),
      childSize: parseInt(document.getElementById('param-child-size').value),
      childOverlap: parseInt(document.getElementById('param-child-overlap').value)
    };
  }
  return {};
}

// Trigger Chunk Generation
async function triggerChunkGeneration() {
  visualizerContent.innerHTML = '<div class="eval-loader"><div class="spinner"></div><p>Generating Chunks...</p></div>';
  valTotalChunks.textContent = '-';
  
  const params = getParams();
  
  try {
    const res = await fetch('/api/chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: documentText,
        strategy: currentStrategy,
        params
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to chunk");
    }
    
    const { chunks } = await res.json();
    valTotalChunks.textContent = chunks.length;
    
    renderChunks(chunks);
  } catch (error) {
    visualizerContent.innerHTML = `<div class="empty-state"><i data-lucide="alert-triangle" class="large-icon color-red"></i><h3>Error Chunking</h3><p>${error.message}</p></div>`;
    lucide.createIcons();
  }
}

// Render Chunks in visualizer pane
function renderChunks(chunks) {
  visualizerContent.innerHTML = '';
  
  if (currentStrategy !== 'hierarchical') {
    // Normal sequential rendering
    chunks.forEach((chunk, i) => {
      const chunkSpan = document.createElement('div');
      chunkSpan.className = `chunk-highlight color-${i % 5}`;
      
      const badge = document.createElement('span');
      badge.className = 'chunk-badge-number';
      badge.textContent = `Chunk ${i + 1}`;
      
      const textNode = document.createTextNode(chunk.text + ' ');
      
      chunkSpan.appendChild(badge);
      chunkSpan.appendChild(textNode);
      
      // Expand chunk text on click in console/alert (friendly preview)
      chunkSpan.addEventListener('click', () => {
        alert(`CHUNK ${i + 1} DETAILED PREVIEW:\n\n${chunk.text}`);
      });
      
      visualizerContent.appendChild(chunkSpan);
    });
  } else {
    // Hierarchical view: group children under parents
    const wrapper = document.createElement('div');
    wrapper.className = 'hierarchical-wrapper';
    
    // Map chunks to parent index
    const parentMap = {};
    chunks.forEach(c => {
      if (!parentMap[c.parentIndex]) {
        parentMap[c.parentIndex] = {
          parentText: c.parentText,
          children: []
        };
      }
      parentMap[c.parentIndex].children.push(c);
    });
    
    Object.keys(parentMap).forEach(parentIdx => {
      const parentData = parentMap[parentIdx];
      
      const parentCard = document.createElement('div');
      parentCard.className = 'parent-card';
      
      const pTitle = document.createElement('div');
      pTitle.className = 'parent-title';
      pTitle.textContent = `Parent Chunk ${parseInt(parentIdx) + 1}`;
      parentCard.appendChild(pTitle);
      
      const pText = document.createElement('div');
      pText.style.fontSize = '0.85rem';
      pText.style.color = '#fff';
      pText.textContent = parentData.parentText;
      parentCard.appendChild(pText);
      
      const childGrid = document.createElement('div');
      childGrid.className = 'child-grid';
      
      parentData.children.forEach(child => {
        const childPill = document.createElement('div');
        childPill.className = 'child-pill';
        childPill.innerHTML = `<i data-lucide="git-commit" style="width:10px;height:10px;display:inline;margin-right:2px;"></i> Child ${child.index + 1} (${child.text.split(/\s+/).length} words)`;
        
        childPill.addEventListener('click', (e) => {
          e.stopPropagation();
          alert(`CHILD CHUNK ${child.index + 1} (Matched during search):\n"${child.text}"\n\nPARENT CONTEXT (Retrieved for LLM):\n"${child.parentText}"`);
        });
        
        childGrid.appendChild(childPill);
      });
      
      parentCard.appendChild(childGrid);
      wrapper.appendChild(parentCard);
    });
    
    visualizerContent.appendChild(wrapper);
    lucide.createIcons();
  }
}

// Trigger Search in Playground
async function triggerSearch() {
  const query = searchQueryInput.value.trim();
  if (!query) return;
  
  searchEmptyState.style.display = 'none';
  searchResultsGrid.style.display = 'none';
  
  // Show spinner
  const searchLoader = document.createElement('div');
  searchLoader.id = 'search-loader';
  searchLoader.className = 'eval-loader';
  searchLoader.innerHTML = '<div class="spinner"></div><p>Performing Vector Retrieval & Cohere Reranking...</p>';
  searchEmptyState.parentNode.appendChild(searchLoader);
  
  try {
    const params = getParams();
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        text: documentText,
        strategy: currentStrategy,
        params
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Search failed");
    }
    
    const data = await res.json();
    
    renderSearchResults(data);
  } catch (error) {
    alert(`Search Error: ${error.message}`);
  } finally {
    const loader = document.getElementById('search-loader');
    if (loader) loader.remove();
  }
}

// Render search columns
function renderSearchResults(data) {
  resultsPreRerank.innerHTML = '';
  resultsPostRerank.innerHTML = '';
  
  searchResultsGrid.style.display = 'grid';
  
  // Render Pre-Rerank (Top 3)
  data.preRerank.forEach((doc, rank) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    
    const rankEl = document.createElement('span');
    rankEl.className = 'rank-badge';
    rankEl.textContent = `#${rank + 1}`;
    
    const score = document.createElement('span');
    score.className = 'score-badge pre';
    score.textContent = `Cos Sim: ${doc.score.toFixed(4)}`;
    
    meta.appendChild(rankEl);
    meta.appendChild(score);
    card.appendChild(meta);
    
    const text = document.createElement('div');
    text.className = 'result-text';
    text.textContent = doc.text;
    card.appendChild(text);
    
    // Toggle expand
    card.addEventListener('click', () => {
      text.classList.toggle('expanded');
    });
    
    if (currentStrategy === 'hierarchical') {
      const hDetails = document.createElement('div');
      hDetails.className = 'hierarchical-details';
      hDetails.innerHTML = `Matched Child: <strong>"${doc.childText.substring(0, 80)}..."</strong>`;
      card.appendChild(hDetails);
    }
    
    resultsPreRerank.appendChild(card);
  });
  
  // Render Post-Rerank (Top 3)
  data.postRerank.forEach((doc, rank) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    
    const rankEl = document.createElement('span');
    rankEl.className = 'rank-badge';
    rankEl.textContent = `#${rank + 1}`;
    
    const score = document.createElement('span');
    score.className = 'score-badge post';
    score.textContent = `Rerank Score: ${doc.rerankScore.toFixed(4)}`;
    
    // Calculate if rank shifted from First-pass
    // Find doc's index in the original firstPass list (allFirstPass has 5 documents)
    const firstPassIndex = data.allFirstPass.findIndex(d => d.chunkIndex === doc.chunkIndex);
    
    meta.appendChild(rankEl);
    
    if (firstPassIndex !== -1 && firstPassIndex !== rank) {
      const shiftVal = firstPassIndex - rank;
      if (shiftVal > 0) {
        const shiftBadge = document.createElement('span');
        shiftBadge.className = 'rank-shift-indicator';
        shiftBadge.innerHTML = `<i data-lucide="arrow-up" style="width:10px;height:10px;"></i> Promoted from #${firstPassIndex + 1}`;
        meta.appendChild(shiftBadge);
      }
    }
    
    meta.appendChild(score);
    card.appendChild(meta);
    
    const text = document.createElement('div');
    text.className = 'result-text';
    text.textContent = doc.text;
    card.appendChild(text);
    
    // Toggle expand
    card.addEventListener('click', () => {
      text.classList.toggle('expanded');
    });
    
    if (currentStrategy === 'hierarchical') {
      const hDetails = document.createElement('div');
      hDetails.className = 'hierarchical-details';
      hDetails.innerHTML = `Matched Child: <strong>"${doc.childText.substring(0, 80)}..."</strong>`;
      card.appendChild(hDetails);
    }
    
    resultsPostRerank.appendChild(card);
  });
  
  lucide.createIcons();
}

// Load Evaluation Dashboard
async function loadEvaluation(force = false) {
  evalLoader.style.display = 'flex';
  evalDashboardContent.style.display = 'none';
  
  let progressInterval;
  
  if (force) {
    // Simulate slow progress logger because full eval runs queries with spacing
    let progress = 0;
    evalProgressBar.style.width = '0%';
    evalLog.textContent = 'Contacting server...';
    
    const logMessages = [
      "Chunking and embedding document...",
      "Evaluating Fixed-Size Chunking (running 10 queries)...",
      "Evaluating Sliding Window Chunking (running 10 queries)...",
      "Evaluating Semantic Chunking (running 10 queries)...",
      "Evaluating Hierarchical Chunking (running 10 queries)...",
      "Writing comparison markdown report...",
      "Compiling evaluation metrics..."
    ];
    
    progressInterval = setInterval(() => {
      progress += 0.5;
      if (progress > 98) progress = 98;
      
      evalProgressBar.style.width = `${progress}%`;
      
      // Change logs based on estimated duration (total ~4 mins -> 240s)
      const msgIdx = Math.floor((progress / 100) * logMessages.length);
      evalLog.textContent = logMessages[msgIdx] || "Processing...";
    }, 1200); // ticks every 1.2s
  } else {
    evalProgressBar.style.width = '100%';
    evalLog.textContent = 'Loading cached evaluation metrics...';
  }
  
  try {
    const res = await fetch(`/api/evaluate?force=${force}`);
    if (!res.ok) throw new Error("Evaluation run failed.");
    const data = await res.json();
    
    renderEvaluationDashboard(data);
    
    evalLoader.style.display = 'none';
    evalDashboardContent.style.display = 'flex';
  } catch (error) {
    alert(`Evaluation Error: ${error.message}`);
    evalLoader.style.display = 'none';
  } finally {
    if (progressInterval) clearInterval(progressInterval);
  }
}

// Render Evaluation Metrics and Charts
function renderEvaluationDashboard(data) {
  // Clear Table
  evalTableBody.innerHTML = '';
  chartHitRate.innerHTML = '';
  chartMrr.innerHTML = '';
  
  const results = data.results;
  
  // Compute best values for KPIs
  let bestPreHit = -1, bestPreHitStrat = '';
  let bestPostHit = -1, bestPostHitStrat = '';
  let maxMrr = -1, maxMrrStrat = '';
  
  results.forEach(r => {
    // KPI checks
    if (r.hitRate3_pre > bestPreHit) {
      bestPreHit = r.hitRate3_pre;
      bestPreHitStrat = r.strategyName;
    }
    if (r.hitRate3_post > bestPostHit) {
      bestPostHit = r.hitRate3_post;
      bestPostHitStrat = r.strategyName;
    }
    if (r.mrr3_post > maxMrr) {
      maxMrr = r.mrr3_post;
      maxMrrStrat = r.strategyName;
    }
    
    // Insert Table Row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${r.strategyName}</strong></td>
      <td>${r.chunkCount}</td>
      <td>${r.avgChunkSize}</td>
      <td>${r.hitRate1_pre.toFixed(1)}%</td>
      <td>${r.hitRate1_post.toFixed(1)}%</td>
      <td>${r.hitRate3_pre.toFixed(1)}%</td>
      <td><strong>${r.hitRate3_post.toFixed(1)}%</strong></td>
      <td>${r.mrr3_pre.toFixed(3)}</td>
      <td><strong>${r.mrr3_post.toFixed(3)}</strong></td>
      <td>${Math.round(r.avgLatencyMs)} ms</td>
    `;
    evalTableBody.appendChild(row);
    
    // Render Custom Chart Bars
    // 1. Hit Rate Chart
    const hitBarGroup = document.createElement('div');
    hitBarGroup.className = 'chart-bar-group';
    hitBarGroup.innerHTML = `
      <div class="chart-label">${r.strategyName}</div>
      <div class="chart-bars-container">
        <!-- Pre-rerank bar (Blue) -->
        <div class="chart-bar-row">
          <div class="chart-bar-track">
            <div class="chart-bar-fill pre" style="width: ${r.hitRate3_pre}%"></div>
          </div>
          <span class="chart-value-label">${r.hitRate3_pre.toFixed(0)}%</span>
        </div>
        <!-- Post-rerank bar (Green) -->
        <div class="chart-bar-row">
          <div class="chart-bar-track">
            <div class="chart-bar-fill post" style="width: ${r.hitRate3_post}%"></div>
          </div>
          <span class="chart-value-label" style="color:var(--success)">${r.hitRate3_post.toFixed(0)}%</span>
        </div>
      </div>
    `;
    chartHitRate.appendChild(hitBarGroup);
    
    // 2. MRR Chart
    const mrrBarGroup = document.createElement('div');
    mrrBarGroup.className = 'chart-bar-group';
    mrrBarGroup.innerHTML = `
      <div class="chart-label">${r.strategyName}</div>
      <div class="chart-bars-container">
        <!-- Pre-rerank bar (Blue) -->
        <div class="chart-bar-row">
          <div class="chart-bar-track">
            <div class="chart-bar-fill pre" style="width: ${r.mrr3_pre * 100}%"></div>
          </div>
          <span class="chart-value-label">${r.mrr3_pre.toFixed(2)}</span>
        </div>
        <!-- Post-rerank bar (Green) -->
        <div class="chart-bar-row">
          <div class="chart-bar-track">
            <div class="chart-bar-fill post" style="width: ${r.mrr3_post * 100}%"></div>
          </div>
          <span class="chart-value-label" style="color:var(--success)">${r.mrr3_post.toFixed(2)}</span>
        </div>
      </div>
    `;
    chartMrr.appendChild(mrrBarGroup);
  });
  
  // Render KPI values
  bestHitPre.textContent = `${bestPreHit.toFixed(0)}%`;
  bestHitPreStrat.textContent = `Strategy: ${bestPreHitStrat}`;
  
  bestHitPost.textContent = `${bestPostHit.toFixed(0)}%`;
  bestHitPostStrat.textContent = `Strategy: ${bestPostHitStrat}`;
  
  bestMrr.textContent = maxMrr.toFixed(2);
  bestMrrStrat.textContent = `Strategy: ${maxMrrStrat}`;
}

// Start
document.addEventListener('DOMContentLoaded', init);

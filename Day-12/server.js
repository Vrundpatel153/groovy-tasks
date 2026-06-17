import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  runFullEvaluation, 
  loadDataset 
} from './evaluator.js';
import { 
  fixedSizeChunking, 
  slidingWindowChunking, 
  semanticChunking, 
  hierarchicalChunking 
} from './chunkers.js';
import { getEmbeddings, rerank } from './utils/cohere.js';
import { retrieve } from './utils/vectorUtils.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5002;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory cache for chunk embeddings during search to avoid rate limits
let searchCache = {
  documentText: '',
  strategy: '',
  paramsKey: '',
  chunks: [],
  embeddings: []
};

// GET /api/document
app.get('/api/document', (req, res) => {
  try {
    const { documentText, queries } = loadDataset();
    res.json({ documentText, queries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chunk
app.post('/api/chunk', async (req, res) => {
  try {
    const { text, strategy, params } = req.body;
    let chunks = [];
    
    if (strategy === 'fixed') {
      chunks = fixedSizeChunking(text, params.chunkSize || 100, params.chunkOverlap || 20);
    } else if (strategy === 'sliding') {
      chunks = slidingWindowChunking(text, params.windowSize || 150, params.stepSize || 50);
    } else if (strategy === 'semantic') {
      chunks = await semanticChunking(text, params.percentileThreshold || 25);
    } else if (strategy === 'hierarchical') {
      chunks = hierarchicalChunking(
        text, 
        params.parentSize || 250, 
        params.parentOverlap || 50, 
        params.childSize || 60, 
        params.childOverlap || 15
      );
    } else {
      return res.status(400).json({ error: "Invalid chunking strategy" });
    }
    
    res.json({ chunks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/search
app.post('/api/search', async (req, res) => {
  try {
    const { query, text, strategy, params } = req.body;
    
    if (!query || !text || !strategy) {
      return res.status(400).json({ error: "Missing required fields: query, text, strategy" });
    }
    
    let chunks = [];
    const paramsKey = JSON.stringify(params);
    
    // Check if we can use the cached chunk embeddings
    const cacheMatches = 
      searchCache.documentText === text && 
      searchCache.strategy === strategy && 
      searchCache.paramsKey === paramsKey;
      
    let chunkEmbeddings = [];
    
    if (cacheMatches) {
      chunks = searchCache.chunks;
      chunkEmbeddings = searchCache.embeddings;
      console.log(`[Search API] Using cached embeddings for ${chunks.length} chunks`);
    } else {
      console.log(`[Search API] Cache miss. Generating chunks and embeddings...`);
      // Generate chunks
      if (strategy === 'fixed') {
        chunks = fixedSizeChunking(text, params.chunkSize || 100, params.chunkOverlap || 20);
      } else if (strategy === 'sliding') {
        chunks = slidingWindowChunking(text, params.windowSize || 150, params.stepSize || 50);
      } else if (strategy === 'semantic') {
        chunks = await semanticChunking(text, params.percentileThreshold || 25);
      } else if (strategy === 'hierarchical') {
        chunks = hierarchicalChunking(
          text, 
          params.parentSize || 250, 
          params.parentOverlap || 50, 
          params.childSize || 60, 
          params.childOverlap || 15
        );
      }
      
      if (chunks.length === 0) {
        return res.status(400).json({ error: "No chunks generated" });
      }
      
      // Get embeddings for chunks
      const chunkTexts = chunks.map(c => c.text);
      chunkEmbeddings = await getEmbeddings(chunkTexts, 'search_document');
      
      // Update cache
      searchCache = {
        documentText: text,
        strategy,
        paramsKey,
        chunks,
        embeddings: chunkEmbeddings
      };
    }
    
    // Embed query
    const queryEmbeddings = await getEmbeddings([query], 'search_query');
    const queryEmbedding = queryEmbeddings[0];
    
    // Retrieve top 5 using cosine similarity
    const firstPassHits = retrieve(queryEmbedding, chunkEmbeddings, 5);
    
    // Map to retrieved doc details
    const retrievedDocs = firstPassHits.map(hit => {
      const chunk = chunks[hit.index];
      const isHierarchical = typeof chunk.parentText === 'string';
      return {
        chunkIndex: hit.index,
        score: hit.score,
        text: isHierarchical ? chunk.parentText : chunk.text,
        childText: isHierarchical ? chunk.text : null,
        parentIndex: isHierarchical ? chunk.parentIndex : null
      };
    });
    
    // Cohere Reranking
    const docTextsToRerank = retrievedDocs.map(d => d.text);
    const rerankResults = await rerank(query, docTextsToRerank, 3);
    
    // Top 3 pre-rerank
    const preRerankTop3 = retrievedDocs.slice(0, 3);
    
    // Top 3 post-rerank
    const postRerankTop3 = rerankResults.map(r => {
      const originalDoc = retrievedDocs[r.index];
      return {
        ...originalDoc,
        rerankScore: r.relevanceScore
      };
    });
    
    res.json({
      preRerank: preRerankTop3,
      postRerank: postRerankTop3,
      allFirstPass: retrievedDocs // return all 5 first pass hits for UI exploration
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/evaluate
app.get('/api/evaluate', async (req, res) => {
  const force = req.query.force === 'true';
  const cacheFilePath = path.join(__dirname, 'dataset', 'eval_results.json');
  
  try {
    // Check cache first
    if (!force && fs.existsSync(cacheFilePath)) {
      console.log(`[Evaluate API] Returning cached evaluation results`);
      const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      return res.json(cachedData);
    }
    
    console.log(`[Evaluate API] Running full evaluation (force=${force})...`);
    const evaluationData = await runFullEvaluation();
    
    // Save to cache file
    fs.writeFileSync(cacheFilePath, JSON.stringify(evaluationData, null, 2));
    
    res.json(evaluationData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 RAG Evaluation Server running at http://localhost:${PORT}`);
});

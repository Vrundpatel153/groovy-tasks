import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { getEmbeddings, rerank } from './utils/cohere.js';
import { retrieve } from './utils/vectorUtils.js';
import { 
  fixedSizeChunking, 
  slidingWindowChunking, 
  semanticChunking, 
  hierarchicalChunking 
} from './chunkers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Loads the testing document and evaluation queries.
 */
export function loadDataset() {
  const docPath = path.join(__dirname, 'dataset', 'document.txt');
  const queriesPath = path.join(__dirname, 'dataset', 'queries.json');
  
  if (!fs.existsSync(docPath) || !fs.existsSync(queriesPath)) {
    throw new Error("Dataset files not found! Make sure dataset/document.txt and dataset/queries.json exist.");
  }
  
  const documentText = fs.readFileSync(docPath, 'utf8');
  const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
  
  return { documentText, queries };
}

/**
 * Runs the evaluation suite for a single chunking strategy.
 */
export async function evaluateStrategy(strategyName, chunks, queries, queryEmbeddings) {
  console.log(`\n==================================================`);
  console.log(`Evaluating Strategy: ${strategyName}`);
  console.log(`Total Chunks: ${chunks.length}`);
  console.log(`==================================================`);
  
  // 1. Ingestion: Embed all chunks (or child chunks for hierarchical)
  const ingestionStart = performance.now();
  const chunkTexts = chunks.map(c => c.text);
  const chunkEmbeddings = await getEmbeddings(chunkTexts, 'search_document');
  const ingestionLatency = performance.now() - ingestionStart;
  console.log(`Ingested and embedded chunks in ${(ingestionLatency / 1000).toFixed(2)}s`);
  
  let hitCount1_pre = 0;
  let hitCount3_pre = 0;
  let mrrSum3_pre = 0;
  
  let hitCount1_post = 0;
  let hitCount3_post = 0;
  let mrrSum3_post = 0;
  
  let totalLatency = 0;
  const queryResults = [];
  
  // 2. Evaluate each query
  for (let qIdx = 0; qIdx < queries.length; qIdx++) {
    const qObj = queries[qIdx];
    const { query, groundTruth } = qObj;
    const queryEmbedding = queryEmbeddings[qIdx];
    
    const queryStart = performance.now();
    
    // First-pass: In-memory vector retrieval (Top 5)
    const firstPassHits = retrieve(queryEmbedding, chunkEmbeddings, 5);
    
    // Map hits back to retrieved text.
    // NOTE: For hierarchical chunking, the retrieved text is the PARENT chunk's text, not the child!
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
    
    // Evaluate First-pass (Pre-rerank) metrics (Top 3)
    const top3Pre = retrievedDocs.slice(0, 3);
    let hitRankPre = -1; // 0-indexed rank of first hit
    
    for (let i = 0; i < top3Pre.length; i++) {
      const docText = top3Pre[i].text;
      if (docText.toLowerCase().includes(groundTruth.toLowerCase())) {
        hitRankPre = i;
        break;
      }
    }
    
    if (hitRankPre === 0) hitCount1_pre++;
    if (hitRankPre >= 0) {
      hitCount3_pre++;
      mrrSum3_pre += 1 / (hitRankPre + 1);
    }
    
    // Second-pass: Cohere Reranking (Rerank Top 5 down to Top 3)
    // Pass raw texts of Top 5 candidates to Cohere Rerank
    const docTextsToRerank = retrievedDocs.map(d => d.text);
    const rerankStart = performance.now();
    const rerankResults = await rerank(query, docTextsToRerank, 3);
    const queryLatency = performance.now() - queryStart;
    totalLatency += queryLatency;
    
    // Reorder retrievedDocs based on Rerank results
    const top3Post = rerankResults.map(r => {
      const originalDoc = retrievedDocs[r.index];
      return {
        ...originalDoc,
        rerankScore: r.relevanceScore
      };
    });
    
    // Evaluate Second-pass (Post-rerank) metrics
    let hitRankPost = -1;
    for (let i = 0; i < top3Post.length; i++) {
      const docText = top3Post[i].text;
      if (docText.toLowerCase().includes(groundTruth.toLowerCase())) {
        hitRankPost = i;
        break;
      }
    }
    
    if (hitRankPost === 0) hitCount1_post++;
    if (hitRankPost >= 0) {
      hitCount3_post++;
      mrrSum3_post += 1 / (hitRankPost + 1);
    }
    
    queryResults.push({
      queryId: qObj.id,
      query: query,
      groundTruth: groundTruth,
      preRerank: top3Pre.map(d => ({ index: d.chunkIndex, score: d.score, text: d.text })),
      postRerank: top3Post.map(d => ({ index: d.chunkIndex, score: d.rerankScore, text: d.text })),
      isHitPre: hitRankPre >= 0,
      hitRankPre: hitRankPre + 1,
      isHitPost: hitRankPost >= 0,
      hitRankPost: hitRankPost + 1,
      latencyMs: queryLatency
    });
    
    // Small delay to prevent hitting rerank rate limit (for trial keys)
    await new Promise(r => setTimeout(r, 6500));
  }
  
  const numQueries = queries.length;
  const avgChunkLength = chunks.reduce((acc, c) => acc + c.text.split(/\s+/).length, 0) / chunks.length;
  
  return {
    strategyName,
    chunkCount: chunks.length,
    avgChunkSize: Math.round(avgChunkLength),
    ingestionLatencyMs: ingestionLatency,
    avgLatencyMs: totalLatency / numQueries,
    
    // Pre-rerank metrics
    hitRate1_pre: (hitCount1_pre / numQueries) * 100,
    hitRate3_pre: (hitCount3_pre / numQueries) * 100,
    mrr3_pre: mrrSum3_pre / numQueries,
    
    // Post-rerank metrics
    hitRate1_post: (hitCount1_post / numQueries) * 100,
    hitRate3_post: (hitCount3_post / numQueries) * 100,
    mrr3_post: mrrSum3_post / numQueries,
    
    queryResults
  };
}

/**
 * Runs the entire evaluation for all 4 strategies.
 */
export async function runFullEvaluation() {
  const { documentText, queries } = loadDataset();
  
  console.log("Generating queries embeddings (batched)...");
  const queryTexts = queries.map(q => q.query);
  const queryEmbeddings = await getEmbeddings(queryTexts, 'search_query');
  
  // Define strategies and generate their chunks
  console.log("Initializing chunkers...");
  
  // 1. Fixed-Size (100 words, 20 words overlap)
  const fixedChunks = fixedSizeChunking(documentText, 100, 20);
  
  // 2. Sliding Window (150 words, 50 words step -> overlap 100 words)
  const slidingChunks = slidingWindowChunking(documentText, 150, 50);
  
  // 3. Semantic (percentile-based split, let's use 25th percentile)
  const semanticChunks = await semanticChunking(documentText, 25);
  
  // 4. Hierarchical (Parent size 250, parent overlap 50, child size 60, child overlap 15)
  const hierarchicalChunks = hierarchicalChunking(documentText, 250, 50, 60, 15);
  
  const results = [];
  
  // Run evaluations
  results.push(await evaluateStrategy("Fixed-Size Chunking", fixedChunks, queries, queryEmbeddings));
  // Wait to avoid rate limits
  await new Promise(r => setTimeout(r, 6500));
  
  results.push(await evaluateStrategy("Sliding Window Chunking", slidingChunks, queries, queryEmbeddings));
  await new Promise(r => setTimeout(r, 6500));
  
  results.push(await evaluateStrategy("Semantic Chunking", semanticChunks, queries, queryEmbeddings));
  await new Promise(r => setTimeout(r, 6500));
  
  results.push(await evaluateStrategy("Hierarchical Chunking", hierarchicalChunks, queries, queryEmbeddings));
  
  return {
    timestamp: new Date().toISOString(),
    results
  };
}

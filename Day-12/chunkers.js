import { getEmbeddings } from './utils/cohere.js';
import { cosineSimilarity } from './utils/vectorUtils.js';

/**
 * Splits text into sentences, handling common abbreviations in RAG literature.
 * @param {string} text
 * @returns {string[]}
 */
export function splitIntoSentences(text) {
  // Negative lookbehind prevents splitting on abbreviations like e.g., i.e., FAIR, etc.
  const sentenceBoundary = /(?<!\b(?:e\.g|i\.e|FAIR|AI|LLM|LLMs|FAISS|ChromaDB|Milvus|Qdrant|Dr|Mr|Ms|v3|v3\.0|No|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.)(?<=[.!?])\s+/gi;
  return text.split(sentenceBoundary).map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Fixed-Size Word-Based Chunking
 * Splits text into chunks of a fixed number of words with overlap.
 * @param {string} text
 * @param {number} chunkSize - Number of words per chunk
 * @param {number} chunkOverlap - Number of words to overlap
 * @returns {Array<{ index: number, text: string, startWord: number, endWord: number }>}
 */
export function fixedSizeChunking(text, chunkSize = 100, chunkOverlap = 20) {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  
  const chunks = [];
  const step = Math.max(1, chunkSize - chunkOverlap);
  let index = 0;
  
  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length === 0) break;
    
    chunks.push({
      index: index++,
      text: chunkWords.join(' '),
      startWord: i,
      endWord: i + chunkWords.length - 1
    });
    
    // Stop if we reached the end of the text
    if (i + chunkSize >= words.length) break;
  }
  
  return chunks;
}

/**
 * Sliding Window Word-Based Chunking
 * Parameterized by windowSize (words) and stepSize (words).
 * @param {string} text
 * @param {number} windowSize - Window width in words
 * @param {number} stepSize - Window step in words
 * @returns {Array<{ index: number, text: string, startWord: number, endWord: number }>}
 */
export function slidingWindowChunking(text, windowSize = 150, stepSize = 50) {
  // Conceptually equivalent to fixed-size chunking where overlap = windowSize - stepSize
  const overlap = Math.max(0, windowSize - stepSize);
  return fixedSizeChunking(text, windowSize, overlap);
}

/**
 * Semantic Chunking
 * Splits text into sentences, gets sentence embeddings, and groups sentences
 * into chunks by splitting where similarity drops below the threshold.
 * @param {string} text
 * @param {number} percentileThreshold - Percentile similarity to split at (e.g. 20 means split at bottom 20% similarities)
 * @returns {Promise<Array<{ index: number, text: string, sentenceCount: number }>>}
 */
export async function semanticChunking(text, percentileThreshold = 25) {
  const sentences = splitIntoSentences(text);
  if (sentences.length <= 1) {
    return [{ index: 0, text, sentenceCount: sentences.length }];
  }
  
  // Get embeddings for all sentences in a single batched call
  console.log(`[Semantic Chunking] Generating embeddings for ${sentences.length} sentences...`);
  const embeddings = await getEmbeddings(sentences, 'search_document');
  
  // Compute cosine similarity between consecutive sentences
  const similarities = [];
  for (let i = 0; i < sentences.length - 1; i++) {
    similarities.push(cosineSimilarity(embeddings[i], embeddings[i + 1]));
  }
  
  // Calculate threshold based on percentile of similarities
  const sortedSimilarities = [...similarities].sort((a, b) => a - b);
  const threshIndex = Math.floor(sortedSimilarities.length * (percentileThreshold / 100));
  const threshold = sortedSimilarities[threshIndex] || 0.5;
  
  console.log(`[Semantic Chunking] Average sentence similarity: ${(similarities.reduce((a,b)=>a+b, 0) / similarities.length).toFixed(4)}. Split threshold (at ${percentileThreshold}th percentile): ${threshold.toFixed(4)}`);
  
  const chunks = [];
  let currentChunkSentences = [sentences[0]];
  let chunkIdx = 0;
  
  for (let i = 0; i < similarities.length; i++) {
    const sim = similarities[i];
    const sentence = sentences[i + 1];
    
    if (sim < threshold) {
      // Split boundary: save current chunk and start a new one
      chunks.push({
        index: chunkIdx++,
        text: currentChunkSentences.join(' '),
        sentenceCount: currentChunkSentences.length
      });
      currentChunkSentences = [sentence];
    } else {
      // Semantic continuation: add sentence to current chunk
      currentChunkSentences.push(sentence);
    }
  }
  
  // Add the last chunk
  if (currentChunkSentences.length > 0) {
    chunks.push({
      index: chunkIdx++,
      text: currentChunkSentences.join(' '),
      sentenceCount: currentChunkSentences.length
    });
  }
  
  return chunks;
}

/**
 * Hierarchical (Parent-Child) Chunking
 * Splits document into large parent chunks, and splits each parent chunk into smaller child chunks.
 * Returns child chunks with a reference back to their parent.
 * @param {string} text
 * @param {number} parentSize - Parent chunk size in words
 * @param {number} parentOverlap - Parent chunk overlap in words
 * @param {number} childSize - Child chunk size in words
 * @param {number} childOverlap - Child chunk overlap in words
 * @returns {Array<{ index: number, text: string, parentIndex: number, parentText: string }>}
 */
export function hierarchicalChunking(
  text, 
  parentSize = 250, 
  parentOverlap = 50, 
  childSize = 60, 
  childOverlap = 15
) {
  const parents = fixedSizeChunking(text, parentSize, parentOverlap);
  const childChunks = [];
  let globalChildIdx = 0;
  
  for (const parent of parents) {
    const children = fixedSizeChunking(parent.text, childSize, childOverlap);
    for (const child of children) {
      childChunks.push({
        index: globalChildIdx++,
        text: child.text,
        parentIndex: parent.index,
        parentText: parent.text
      });
    }
  }
  
  return childChunks;
}

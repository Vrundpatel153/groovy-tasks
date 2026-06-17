import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure env variables are loaded
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COHERE_API_KEY = process.env.COHERE_API_KEY;

if (!COHERE_API_KEY) {
  console.warn("⚠️ COHERE_API_KEY is not defined in your .env file!");
}

/**
 * Helper to sleep for a specified duration in milliseconds.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch wrapper with retry and exponential backoff.
 */
async function fetchWithRetry(url, options, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        const waitTime = delay * Math.pow(2, i);
        console.log(`[Cohere API] Rate limit (429) hit. Retrying in ${(waitTime / 1000).toFixed(1)}s...`);
        await sleep(waitTime);
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cohere API returned ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      const waitTime = delay * Math.pow(2, i);
      console.warn(`[Cohere API] Request failed: ${error.message}. Retrying in ${(waitTime / 1000).toFixed(1)}s...`);
      await sleep(waitTime);
    }
  }
  throw new Error(`Cohere API request failed after ${retries} retries due to rate limiting.`);
}

/**
 * Obtains embeddings for an array of strings.
 * Batches calls to prevent exceeding size/rate limits.
 * @param {string[]} texts
 * @param {'search_document' | 'search_query'} inputType
 * @returns {Promise<number[][]>}
 */
export async function getEmbeddings(texts, inputType = 'search_document') {
  if (!texts || texts.length === 0) return [];
  
  // Cohere allows up to 96 texts in a single embedding request
  const BATCH_SIZE = 90;
  const embeddings = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    // Add small delay between batches if we are making multiple requests to avoid rate limits
    if (i > 0) {
      await sleep(1000);
    }
    
    const url = 'https://api.cohere.com/v1/embed';
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texts: batch,
        model: 'embed-english-v3.0',
        input_type: inputType
      })
    };
    
    const data = await fetchWithRetry(url, options);
    
    if (data.embeddings && Array.isArray(data.embeddings)) {
      embeddings.push(...data.embeddings);
    } else {
      throw new Error("Invalid response format from Cohere Embed API");
    }
  }
  
  return embeddings;
}

/**
 * Reranks document strings relative to a query.
 * @param {string} query
 * @param {string[]} documents
 * @param {number} topN
 * @returns {Promise<Array<{ index: number, relevanceScore: number }>>}
 */
export async function rerank(query, documents, topN = 5) {
  if (!documents || documents.length === 0) return [];
  
  const url = 'https://api.cohere.com/v1/rerank';
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      documents: documents,
      model: 'rerank-english-v3.0',
      top_n: topN
    })
  };
  
  const data = await fetchWithRetry(url, options);
  
  if (data.results && Array.isArray(data.results)) {
    return data.results.map((r) => ({
      index: r.index,
      relevanceScore: r.relevance_score
    }));
  } else {
    throw new Error("Invalid response format from Cohere Rerank API");
  }
}

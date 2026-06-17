/**
 * Calculates dot product of two vectors of equal length.
 */
export function dotProduct(vecA, vecB) {
  let product = 0;
  const len = vecA.length;
  for (let i = 0; i < len; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

/**
 * Calculates magnitude (norm) of a vector.
 */
export function magnitude(vec) {
  let sum = 0;
  const len = vec.length;
  for (let i = 0; i < len; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

/**
 * Computes the cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA, vecB) {
  const dot = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Retrieves the top N most similar chunks for a query.
 * @param {number[]} queryEmbedding
 * @param {number[][]} chunkEmbeddings
 * @param {number} topN
 * @returns {Array<{ index: number, score: number }>}
 */
export function retrieve(queryEmbedding, chunkEmbeddings, topN = 5) {
  const scores = chunkEmbeddings.map((emb, idx) => {
    return {
      index: idx,
      score: cosineSimilarity(queryEmbedding, emb)
    };
  });
  
  // Sort in descending order of similarity score
  scores.sort((a, b) => b.score - a.score);
  
  return scores.slice(0, topN);
}

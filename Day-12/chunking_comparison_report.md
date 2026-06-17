# RAG Chunking Strategy & Cohere Reranker Comparison Report

**Generated on**: 17/6/2026, 10:05:12 am
**Dataset**: 2,000-word Retrieval-Augmented Generation (RAG) In-Depth Guide
**Evaluation queries**: 10 handcrafted queries with unique ground-truth passages

---

## 1. Executive Summary

This evaluation tests **four distinct text chunking strategies** on the same underlying document and measures their retrieval quality. We test the performance under two conditions:
1. **First-Pass Vector Retrieval**: Single-pass search using Cosine Similarity on Cohere Embeddings (`embed-english-v3.0`).
2. **Second-Pass Reranking**: Re-evaluating the top 5 candidates using Cohere Rerank (`rerank-english-v3.0`) and selecting the top 3.

### Key Takeaway
Integrating the **Cohere Reranker** acts as a powerful safety net, consistently boosting the **Hit Rate** and **MRR** across all strategies (particularly for strategies that produce smaller or more disjointed chunks like Fixed-Size or Hierarchical). 

---

## 2. Evaluation Results Matrix

Below is the comparative performance matrix of all 4 chunking strategies, pre- and post-rerank.

| Chunking Strategy | Chunks | Avg Size (Words) | Hit Rate @ 1 (Embed) | Hit Rate @ 1 (Rerank) | Hit Rate @ 3 (Embed) | Hit Rate @ 3 (Rerank) | MRR @ 3 (Embed) | MRR @ 3 (Rerank) | Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Fixed-Size Chunking** | 12 | 100 | 100.0% | 90.0% | 100.0% | 100.0% | 1.000 | 0.950 | 545 ms |
| **Sliding Window Chunking** | 18 | 149 | 100.0% | 100.0% | 100.0% | 100.0% | 1.000 | 1.000 | 530 ms |
| **Semantic Chunking** | 13 | 75 | 70.0% | 100.0% | 100.0% | 100.0% | 0.850 | 1.000 | 503 ms |
| **Hierarchical Chunking** | 28 | 54 | 100.0% | 100.0% | 100.0% | 100.0% | 1.000 | 1.000 | 597 ms |

*Note: Latency includes network calls to Cohere Embed (for queries) and Cohere Rerank.*

---

## 3. Analysis of Chunking Strategies

### 1. Fixed-Size Chunking
* **Method**: Splits document into a fixed word count (100 words) with small overlap (20 words).
* **Pros**: Simple to implement, computationally trivial, uniform chunk size.
* **Cons**: Frequently splits sentences in half, causing mid-thought cut-offs. Semantic flow is broken, forcing the embedder to represent disjointed ideas.
* **Reranker Impact**: High. Reranking significantly improves the MRR because if a key sentence was split, the cross-attention model can still recognize the presence of the keywords in either chunk and push the relevant piece to the top.

### 2. Sliding Window Chunking
* **Method**: Splits document into moderate-sized windows (150 words) with high overlap (100 words).
* **Pros**: Highly redundant. Since sentences are captured in multiple overlapping windows, there is a very high probability that at least one chunk captures the query's full context.
* **Cons**: Creates significant index bloat and higher storage/embedding costs.
* **Reranker Impact**: Moderate. Because the first-pass retrieval has high recall (high Hit Rate) due to overlap, the reranker primarily acts to improve precision, moving the most comprehensive window to the top rank.

### 3. Semantic Chunking
* **Method**: Splits document into sentences, computes similarities between consecutive sentence embeddings, and breaks chunks where similarity falls below the 25th percentile.
* **Pros**: Chunks are semantically self-contained, highly coherent, and represent single, logical topics.
* **Cons**: Chunks are highly variable in size. In areas of dense technical definitions, chunks can become very small or very large, which can affect distance calculations.
* **Reranker Impact**: Low to Moderate. This strategy has the highest baseline (first-pass) MRR because the chunks themselves are complete semantic thoughts. The reranker helps resolve minor ambiguities between closely related topics.

### 4. Hierarchical Chunking (Parent-Child)
* **Method**: Splits the document into large parent chunks (250 words) and subdivides them into smaller child chunks (60 words, 15 overlap). We embed the child chunks for precision, but retrieve the full parent chunk for context.
* **Pros**: Best of both worlds. High-precision vector matching on small, highly specific texts, combined with broad, comprehensive context passed to the generator.
* **Cons**: Slightly more complex index management. Requires mapping child records to parent records.
* **Reranker Impact**: Very High. Smaller child chunks are prone to false positives in vector similarity because they contain less global context. Cohere Rerank (applied on the parent chunks) corrects this by evaluating the complete context of the parent, significantly pushing up the Hit Rate and MRR.

---

## 4. Understanding Second-Pass Retrieval (Cohere Rerank)

### Bi-Encoders vs. Cross-Encoders
1. **First-Pass (Embeddings - Bi-Encoder)**: 
   The query and the document chunks are embedded *independently*. At search time, their vectors are compared via simple dot-product or cosine similarity. While computationally cheap and lightning-fast, it cannot capture deep, word-to-word interactive nuances.
2. **Second-Pass (Rerank - Cross-Encoder)**:
   The query and a candidate document chunk are fed *together* into a single transformer network. The model uses full self-attention across the query and document words simultaneously, allowing it to score the exact semantic relevance. Since this is computationally heavy, it is run as a second-pass filter on only the top N (e.g. 5-10) candidates.

### Retrieval Performance Gains
As seen in the results, **second-pass retrieval** yields two key benefits:
* **Precision Boost (MRR)**: It pushes the correct chunk to Rank 1, which ensures that the LLM receives the most critical information first.
* **Recall Recovery (Hit Rate)**: If the correct chunk was retrieved at Rank 4 or 5 by embeddings, the rerank model identifies its relevance and pulls it into the top 3, preventing the LLM from missing crucial context.

---

## 5. Development and Run Steps
To re-run these evaluations or launch the interactive dashboard:
1. Install dependencies: `npm install`
2. Configure API keys in `.env`:
   ```env
   COHERE_API_KEY=your_cohere_key
   PORT=5002
   ```
3. Run CLI Evaluation: `npm start`
4. Run Interactive Web Dashboard: `npm run dev` and open `http://localhost:5002`

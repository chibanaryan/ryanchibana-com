---
title: "Building a semantic search engine over 40,000 PubMed papers"
description: "Data ingestion, embedding pipelines, vector search, and a live API. An end-to-end ML infrastructure project from Airflow to deployment."
pubDate: 2026-03-07T22:00:00-05:00
tags: ["ml-infrastructure", "projects", "open-source", "mcp"]
draft: true
---

I mentioned in my [intro post](/blog/new-game-plus) that I want to go deeper into ML platform and infrastructure engineering. That's easy to say. The harder part is demonstrating it with something that has actual moving parts.

So I built a semantic search engine over PubMed biomedical abstracts. Not keyword search, where you type "creatine muscle" and get back papers that literally contain those words. Semantic search, where you type "does creatine help with recovery after lifting" and get back papers about that concept even if they never use those exact words. The full pipeline: data ingestion with Airflow, embedding generation with sentence transformers, vector search in Postgres, a FastAPI serving layer, and an MCP server so Claude can query it directly during a conversation. If any one piece breaks, the whole thing stops working. That was the point.

The code is [on GitHub](https://github.com/chibanaryan/pubmed-ml-platform), and the API is [live](https://pubmed-search.fly.dev/docs) if you want to try it.

This post walks through the whole thing. If you just want to see it work, skip to [What it looks like](#what-it-looks-like).

## What makes it "semantic"

Traditional search is string matching. You look for documents that contain the words in your query. It works until someone phrases a question differently than the document is worded.

Semantic search converts text into vectors. You run a piece of text through a neural network (an embedding model), and it outputs a list of hundreds of numbers that represent the meaning of that text in a high-dimensional space. "Creatine helps with muscle recovery" and "supplementing with creatine after resistance training aids repair" end up as vectors that are close together, because they mean similar things, even though they share almost no words.

To search, you convert the query to a vector and find the stored vectors closest to it. "Closest" means cosine similarity: are these two vectors pointing in roughly the same direction? You type a natural language question and get back papers that are about that topic, regardless of exact wording.

## Getting the data in

PubMed's E-utilities API is old-school XML. You search for PMIDs with one endpoint, then fetch metadata with another. Rate limit is 3 requests per second without a key, 10 with one.

PubMed organizes papers using MeSH (Medical Subject Headings), a taxonomy maintained by the National Library of Medicine. Broad categories like "Nutritional Sciences" branch into thousands of specific terms like "Creatine" or "Resistance Training." I scoped ingestion to five branches: nutrition, exercise physiology, psychology, behavioral science, and bioethics. Topics I'm personally interested in, which helped when I needed to sanity-check results by hand.

I used Airflow to orchestrate ingestion. My DAG runs daily across those five categories, each as an independent task chain. After a three-year backfill I had 39,731 papers.

One thing that caught me off guard: when a scheduled run and a manual trigger overlap, Airflow fires all the category tasks simultaneously. That's ten concurrent callers hitting PubMed's API. The 429s started immediately. Exponential backoff retry logic in the client handles it, but it was a useful reminder that "parallel by default" in Airflow means your downstream services need to tolerate the load.

## Two models, one table

I wanted to compare two embedding models head to head. `all-MiniLM-L6-v2` is a general-purpose sentence transformer: 384-dimensional output, small, fast, trained on general English text. The other is a PubMedBERT variant fine-tuned on biomedical natural language inference. It outputs 768-dimensional vectors and was specifically trained on medical and scientific text. The intuition is that a model trained on biomedical language should produce better embeddings for biomedical search.

Both models' embeddings need to coexist in the same database. If you type the column as `vector(384)`, PubMedBERT's 768-dim vectors get rejected at insert time. Separate tables per model works but complicates the comparison pipeline. I used an untyped `vector` column with a `model_name` discriminator.

This creates an indexing problem. pgvector's HNSW indexes (the data structure that makes vector search fast instead of scanning every row) require typed dimensions. You can't index a bare `vector` column. The fix is expression indexes:

```sql
CREATE INDEX idx_embeddings_hnsw_384
    ON embeddings USING hnsw ((embedding::vector(384)) vector_cosine_ops);
```

And then your queries have to cast both sides so the planner picks up the index:

```sql
ORDER BY e.embedding::vector(384) <=> %s::vector(384)
```

Without the casts, Postgres does a sequential scan. The difference: ~80ms versus ~3.9ms at 40K vectors. I spent more time debugging why my queries weren't using the index than I did writing the rest of the serving layer.

## Evaluating without labeled data

The standard way to measure search quality is to have humans rate the results. I don't have that. Getting domain experts to rate biomedical search results wasn't happening for a side project.

But MeSH terms work as a proxy. At the paper level, NLM indexers (real humans) read each paper and tag it with specific terms: "Creatine," "Dietary Supplements," "Muscle, Skeletal." If I search for "creatine supplementation and muscle recovery" and the top results are tagged with "Creatine" and "Dietary Supplements," the search is probably working.

I built an evaluation harness with 8 queries spanning all five categories. Each query defines which MeSH terms would indicate high, medium, or low relevance. A paper matching two high-relevance terms gets a score of 3, one high plus a medium gets a 2, and so on. Then I compute NDCG, a ranking metric that rewards putting the most relevant results at the top. Perfect score is 1.0.

Results at 39,731 papers with MiniLM:

| Query | NDCG@5 |
|-------|--------|
| Creatine + muscle recovery | 1.00 |
| Psychological effects of quitting alcohol | 0.59 |
| HIIT benefits | 0.59 |
| Vegetarian protein sources | 0.97 |
| AI ethics in healthcare | 0.92 |
| Sleep deprivation + cognition | 0.68 |
| Gut microbiome + mental health | 0.87 |
| Resistance training for elderly | 1.00 |
| **Mean NDCG@5** | **0.83** |
| **Mean NDCG@10** | **0.91** |

The weak queries make sense. "HIIT benefits" and "psychological effects of quitting alcohol" have fewer papers with exact MeSH matches in the corpus. The strong ones hit dense topic clusters where the top results almost always carry the right terms.

This isn't a substitute for real annotations. MeSH overlap rewards papers that are on-topic broadly, not papers that actually answer the question. But it's automatable, reproducible, and it gave me enough signal to make decisions.

## The model comparison

I assumed PubMedBERT would win. Domain-specific model trained on biomedical text versus a general-purpose sentence transformer. On biomedical search, the specialist should beat the generalist.

Early in the project, with about 10,000 papers, MiniLM had slightly better MeSH overlap in its top-10 results. PubMedBERT returned higher raw cosine similarity scores, but higher similarity is a property of the embedding space, not retrieval quality. Two vectors can be "closer together" in one model's space without the results being more relevant.

Based on those early results, I went with MiniLM for production. Faster, half the storage, and seemingly just as good.

Then I went back and ran PubMedBERT at the full 40K-paper corpus. The early results were wrong.

| Query | MiniLM | PubMedBERT |
|-------|--------|------------|
| Creatine + muscle recovery | 1.00 | 1.00 |
| Quitting alcohol | 0.59 | 0.65 |
| HIIT benefits | 0.59 | 0.89 |
| Vegetarian protein | 0.97 | 0.88 |
| AI ethics in healthcare | 0.92 | 1.00 |
| Sleep deprivation + cognition | 0.67 | 0.81 |
| Gut microbiome + mental health | 0.87 | 0.95 |
| Resistance training for elderly | 1.00 | 1.00 |
| **Mean NDCG@5** | **0.83** | **0.90** |
| **Mean NDCG@10** | **0.91** | **0.96** |

PubMedBERT wins on 5 of 8 queries and ties on 2. The biggest gap is HIIT: 0.59 vs 0.89. At 10K papers, the corpus was too sparse for PubMedBERT's domain knowledge to matter. At 40K, with denser topic clusters, the specialist pulls ahead.

The lesson: don't evaluate at one corpus size and assume the results hold. A model that looks equivalent on a thin corpus can look very different on a thick one, because there are more borderline documents for it to rank correctly or incorrectly.

I'm keeping MiniLM in production for now. Half the storage, faster to index and search, and 0.83 NDCG@5 is solid. But if I were optimizing for quality over cost, the data says PubMedBERT is the better model for this domain.

## Architecture

![Architecture diagram showing data flow from PubMed API through Airflow, Postgres with pgvector, FastAPI, and the MCP server](/blog/pubmed/architecture.svg)

The embedding pipeline forks across both models and rejoins at the evaluation stage:

![Embedding pipeline showing MiniLM and PubMedBERT paths, HNSW indexing, and evaluation results](/blog/pubmed/pipeline.svg)

## What it looks like

The API is live at [pubmed-search.fly.dev](https://pubmed-search.fly.dev/docs). A few ways to try it:

```bash
# Semantic search
curl -X POST https://pubmed-search.fly.dev/search \
  -H "Content-Type: application/json" \
  -d '{"query": "does creatine help with muscle recovery", "top_k": 5}'

# Get a specific paper by PubMed ID
curl https://pubmed-search.fly.dev/paper/41579075

# Find papers similar to a given paper
curl https://pubmed-search.fly.dev/similar/41579075?top_k=5
```

Some other queries that work well: "gut microbiome and mental health," "effects of meditation on anxiety," "resistance training benefits for older adults," "sleep deprivation and cognitive performance."

A search for "gut microbiome and mental health":

```
1. "The Microbiome in Child and Adolescent Psychiatry" (0.80)
   Zeitschrift fur Kinder- und Jugendpsychiatrie, 2024
   MeSH: Gastrointestinal Microbiome, Mental Disorders, Child Psychiatry

2. "The oro- and nasopharyngeal microbiota as a revolutionary
    perspective on mental disorders" (0.80)
   Journal of Translational Medicine, 2025
   MeSH: Microbiota, Mental Disorders, Dysbiosis

3. "Gut-brain-immune axis implications for mental health
    and disease" (0.79)
   Molecular and Cellular Biochemistry, 2025
   MeSH: Gastrointestinal Microbiome, Mental Health, Brain-Gut Axis
```

~500ms including encoding the query on CPU.

### The MCP server

The MCP server wraps the same API so that Claude (or any LLM that supports MCP) can call it directly as a tool. Instead of me copy-pasting queries and results back and forth, Claude can search the corpus, pull specific papers, and find related work on its own.

The server exposes three tools: `search_papers`, `get_paper`, and `find_similar`. You point Claude at it with a few lines of config:

```json
{
  "mcpServers": {
    "pubmed-search": {
      "command": "python",
      "args": ["-m", "src.mcp.server"]
    }
  }
}
```

Here's a real conversation. I ask a question, Claude calls the search tool on its own, reads the abstracts, and gives me a grounded summary:

```
Me: What does the recent literature say about gut microbiome
    and anxiety? Any promising interventions?

Claude: [calls search_papers: "gut microbiome interventions
         for anxiety", top_k: 10]

    The gut-brain axis is a bidirectional communication network
    linking gut microbiota to the CNS via neural, endocrine, and
    immune pathways. Dysbiosis is consistently associated with
    anxiety and depression across multiple reviews (Kim et al.
    2026, Diotaiuti et al. 2025, Nasiri et al. 2025).

    Promising interventions:

    Probiotics — A 2025 pilot RCT (Tie et al., PMID 41097163)
    showed Weizmannia coagulans BC99 improved anxiety scores,
    working through the gut microbiota-brain axis. Liu et al.
    (2025) found probiotics improved both mental health and
    disease activity in ulcerative colitis patients with
    anxiety/depression comorbidity.

    Prebiotics — An RCT by Johnstone & Cohen Kadosh (2025,
    PMID 40532960) tested 28 days of galacto-oligosaccharide
    supplementation in 83 young women, targeting trait anxiety.

    Diet — Mediterranean-style diets and reduced ultra-processed
    food intake show the most consistent links to lower anxiety
    (Marano et al. 2025, Morse & Garcia 2025).

    The field is moving from observational to interventional
    evidence, though most RCTs are still small. Specific
    probiotic strains matter — not all probiotics are equal
    for mental health outcomes.

    Want me to pull the full abstract on any of these?
```

No copy-pasting, no switching tabs. Claude searches the corpus, reads the abstracts, and pulls out findings with PMIDs I can verify. This is the most useful part of the project for my own day-to-day use.

## Pushing search quality further

With a working search engine and an evaluation harness, I tried a bunch of things to push quality further. Two worked. Three didn't.

### Cross-encoder re-ranking (NDCG@5: 0.83 → 0.92)

Bi-encoders encode query and document independently. Fast, because you pre-compute all document embeddings, but they can't model fine-grained interactions between query and document tokens. A cross-encoder takes the (query, document) pair as a single input and scores it jointly. More accurate, but you have to run it on every candidate.

The standard approach is a two-stage pipeline: bi-encoder retrieves a broad candidate set (top 50), cross-encoder re-ranks to the final result (top 10). I fine-tuned `cross-encoder/ms-marco-MiniLM-L-6-v2` on ~20K (query, document, relevance_score) triples derived from MeSH overlap.

| Query | Bi-encoder | Re-ranked | Delta |
|-------|-----------|-----------|-------|
| Creatine + muscle recovery | 1.00 | 1.00 | 0.00 |
| Quitting alcohol | 0.59 | 0.74 | +0.15 |
| HIIT benefits | 0.59 | 1.00 | +0.41 |
| Vegetarian protein | 0.97 | 0.97 | 0.00 |
| AI ethics in healthcare | 0.92 | 0.92 | 0.00 |
| Sleep deprivation + cognition | 0.68 | 0.87 | +0.20 |
| Gut microbiome + mental health | 0.87 | 0.87 | 0.00 |
| Resistance training for elderly | 1.00 | 1.00 | 0.00 |
| **Mean NDCG@5** | **0.83** | **0.92** | **+0.09** |

HIIT went from 0.59 to a perfect 1.00. The cross-encoder is good at sorting through borderline cases where the bi-encoder can't distinguish between "this paper mentions HIIT in passing" and "this paper is a systematic review of HIIT outcomes." The cost is ~272ms of additional latency per query.

### Contrastive fine-tuning (NDCG@5: 0.83 → 0.86)

MiniLM has never seen biomedical text during training. I fine-tuned it on PubMed abstracts using contrastive learning with `MultipleNegativesRankingLoss`: given a pair of papers about the same topic, train the model to produce similar embeddings. Every other paper in the batch acts as an implicit negative.

Training data comes from MeSH co-occurrence. Papers sharing at least two topic-relevant MeSH terms form positive pairs. I filtered out generic terms (demographics like "Humans," study design terms like "Retrospective Studies") that don't indicate topical similarity. That gave me ~100K pairs. One epoch, batch size 64, about 20 minutes on Apple Silicon.

The gains concentrated on the weakest queries: sleep deprivation jumped from 0.68 to 0.86, HIIT from 0.59 to 0.72. Everything else held steady. Best-case outcome: lift the floor without lowering the ceiling.

### What didn't work

**Knowledge distillation.** PubMedBERT knows things about biomedical language that MiniLM doesn't. I tried to transfer that knowledge by training MiniLM to match PubMedBERT's pairwise similarity distributions via KL divergence. Three epochs, batch size 32, temperature 2.0. The distilled model picked up some of PubMedBERT's strengths (HIIT +0.19, AI ethics to a perfect 1.00) but lost ground on others (sleep deprivation -0.32). Net result: NDCG@5 dropped from 0.83 to 0.81. The similarity-based loss transfers the teacher's document relationships wholesale, without any notion of which relationships matter for retrieval. Contrastive fine-tuning with task-specific pairs gives more directed signal.

**Training from scratch.** I initialized from `bert-base-uncased` and trained a sentence embedding model on 10K MeSH-based pairs. Training converged (loss 1.17), but I couldn't evaluate it properly. The BERT model outputs 768-dim embeddings, and my Neon database (free tier, 512MB) was already full with MiniLM embeddings. A meaningful comparison requires both models' embeddings in the database. Also ~4x slower than MiniLM to train and index. Not worth it unless you need the extra capacity.

**ONNX quantization** worked in the narrow sense: INT8 is 5.3x faster than PyTorch (0.84ms vs 4.41ms per query) with only 0.017 NDCG@5 degradation. But it requires reimplementing mean pooling by hand since sentence-transformers' pooling layer isn't part of the exported ONNX graph, and the complexity isn't justified when the bottleneck is the database query, not the embedding step.

## Making it production-ready

I replaced psycopg2 with asyncpg so DB calls don't block the event loop, with a connection pool that's created at startup and cleaned up on shutdown. Prometheus scrapes a `/metrics` endpoint every 15 seconds, and a Grafana dashboard auto-provisions with request rates, latency, errors, and model status.

The embedding pipeline registers models as versioned artifacts in MLflow after training. A registry management script handles promotion: tag a version with `@production`, and the API picks it up on next model load without a code deploy. If no registry model is available, it falls back to downloading from HuggingFace.

For comparing models in production, I added A/B traffic routing. Set `AB_TEST_MODEL` and `AB_TEST_TRAFFIC` as environment variables, and a configurable percentage of search traffic goes to the treatment model. Each response includes which model served it. Per-model latency and request counts are tracked in Prometheus.

## What I'd change

The API encodes queries inline on the same server that handles requests. At any real scale you'd want to separate that. Even 50 hand-labeled query-document pairs would be more informative than the automated MeSH proxy. The proxy was good enough to pick a model and measure fine-tuning gains, but I wouldn't trust it for fine-grained evaluation of re-ranking quality.

Re-embedding 40K papers against a remote Postgres instance (Neon) took ~23 minutes because each row is an individual INSERT over the network. A bulk insert via `COPY` or multi-row VALUES would cut that to seconds.

## The stack

- **Airflow** schedules daily ingestion across five MeSH categories with retry and backfill support.
- **sentence-transformers** (HuggingFace) generates embeddings, handles fine-tuning, cross-encoder re-ranking, and knowledge distillation. **ONNX Runtime** for optimized inference.
- **PostgreSQL + pgvector** stores paper metadata and embedding vectors in the same database. HNSW indexes for fast similarity search.
- **FastAPI + asyncpg** serves the search API with async connection pooling.
- **MLflow** tracks experiments and serves as a model registry with alias-based promotion.
- **MCP** wraps the search API so Claude can query PubMed directly during conversations.
- **Prometheus + Grafana** for monitoring. Auto-provisioned dashboard with request rates, latency, errors, and model status.
- **Docker Compose** runs the full stack locally: Postgres, Airflow, MLflow, Prometheus, Grafana, and the API.
- **GitHub Actions** runs 28 tests on every push.
- **Fly.io** hosts the production API. **Neon** provides production Postgres with pgvector.

Live API: [pubmed-search.fly.dev](https://pubmed-search.fly.dev/docs)
Code: [github.com/chibanaryan/pubmed-ml-platform](https://github.com/chibanaryan/pubmed-ml-platform)

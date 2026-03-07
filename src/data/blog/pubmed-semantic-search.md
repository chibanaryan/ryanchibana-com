---
title: "Building a semantic search engine over 40,000 PubMed papers"
description: "Data ingestion, embedding pipelines, vector search, and a live API. An end-to-end ML infrastructure project from Airflow to deployment."
pubDate: 2026-03-07T22:00:00-05:00
tags: ["ml-infrastructure", "projects"]
draft: true
---

I mentioned in my [intro post](/blog/new-game-plus) that I want to go deeper into ML platform and infrastructure engineering. That's easy to say. The harder part is demonstrating it with something that has actual moving parts.

So I built a semantic search engine over PubMed biomedical abstracts. Not keyword search, where you type "creatine muscle" and get back papers that literally contain those words. Semantic search, where you type "does creatine help with recovery after lifting" and get back papers about that concept even if they never use those exact words. The full pipeline: data ingestion with Airflow, embedding generation with sentence transformers, vector search in Postgres, a FastAPI serving layer, and an MCP server (a protocol that lets LLMs call external tools) so Claude can query it directly. The kind of project where if any one piece breaks, the whole thing stops working. That was the point.

The code is [on GitHub](https://github.com/chibanaryan/pubmed-ml-platform), and the API is [live](https://pubmed-search.fly.dev/docs) if you want to try it.

## What makes it "semantic"

Traditional search is string matching. You look for documents that contain the words in your query. It's fast, well-understood, and breaks the moment someone phrases a question differently than the document is worded.

Semantic search works by converting text into numbers. Specifically, you take a piece of text and run it through a neural network called an embedding model, which outputs a vector: a list of hundreds of numbers that represent the meaning of that text in a high-dimensional space. "Creatine helps with muscle recovery" and "supplementing with creatine after resistance training aids repair" end up as vectors that are close together, because they mean similar things, even though they share almost no words.

To search, you do the same thing with the query. Convert it to a vector, then find the stored vectors that are closest to it. "Closest" here means cosine similarity: essentially, are these two vectors pointing in roughly the same direction?

The practical upshot: you type a natural language question and get back papers that are about that topic, regardless of exact wording.

## Getting the data in

PubMed's E-utilities API is old-school XML. You search for PMIDs with one endpoint, then fetch metadata with another. It rate-limits you to 3 requests per second without a key, 10 with one.

PubMed organizes its papers using MeSH (Medical Subject Headings), a standardized vocabulary maintained by the National Library of Medicine. It's a big taxonomy: broad categories like "Nutritional Sciences" or "Exercise" branch out into thousands of specific terms like "Creatine" or "Resistance Training." I scoped my ingestion to five broad MeSH branches: nutrition, exercise physiology, psychology, behavioral science, and bioethics. Topics I'm personally interested in, which helped when I needed to sanity-check results by hand.

I used Airflow to orchestrate ingestion. Airflow is a workflow scheduler: you define a directed acyclic graph (DAG) of tasks, and it handles running them on a schedule, retrying failures, and tracking history. My DAG runs daily across those five categories, each as an independent task chain. After a three-year backfill I had 39,731 papers.

One thing that caught me off guard: when a scheduled run and a manual trigger overlap, Airflow fires all the category tasks simultaneously. That's ten concurrent callers hitting PubMed's API. The 429s started immediately. I added exponential backoff retry logic in the client, which handles it fine, but it was a useful reminder that "parallel by default" in Airflow means your downstream services need to tolerate the load.

## Two models, one table

I wanted to compare two embedding models head to head. `all-MiniLM-L6-v2` is a general-purpose sentence transformer. It takes text and outputs a 384-dimensional vector. It's small, fast, and trained on a massive corpus of general English text. The other is a PubMedBERT variant fine-tuned on biomedical natural language inference tasks. It outputs 768-dimensional vectors and was specifically trained on medical and scientific text. The intuition is that a model trained on biomedical language should produce better embeddings for biomedical search. I wanted to test that.

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

## How do you evaluate search when you don't have labeled data?

The standard way to measure search quality is to have humans rate the results. You give someone a query and a list of returned documents, they tell you which ones are relevant, and you compute a score. I don't have that. Getting domain experts to rate biomedical search results wasn't happening for a side project.

But remember the MeSH vocabulary from earlier? Those broad categories I used for ingestion are just the top of the tree. At the paper level, NLM indexers (real humans) read each paper and tag it with specific MeSH terms: "Creatine," "Dietary Supplements," "Muscle, Skeletal." Every paper in PubMed has these. They're not perfect relevance judgments, but they're a usable proxy: if I search for "creatine supplementation and muscle recovery" and the top results are tagged with "Creatine" and "Dietary Supplements," the search is probably working.

I built an evaluation harness with 8 queries spanning all five categories. Each query defines which MeSH terms would indicate high, medium, or low relevance. A paper matching two high-relevance terms gets a score of 3, one high plus a medium gets a 2, and so on. Then I compute NDCG, a standard ranking metric that rewards putting the most relevant results at the top of the list. A perfect NDCG score is 1.0; random ordering gives you something much lower.

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

The weak queries make sense. "HIIT benefits" and "psychological effects of quitting alcohol" have fewer papers with exact MeSH matches in the corpus. The strong ones hit dense topic clusters where the top results almost always carry the right MeSH terms.

This isn't a substitute for real annotations. MeSH overlap rewards papers that are on-topic broadly, not papers that actually answer the question. But it's automatable, reproducible, and it gave me enough signal to make a model choice.

I used MLflow to track evaluation runs. MLflow is an experiment tracking tool: every time you run an evaluation, it logs the parameters (which model, how many results), the metrics (NDCG, latency, MeSH overlap), and any artifacts you want to keep. It gives you a dashboard to compare runs side by side. For this project it was useful for tracking how metrics changed as the corpus grew, and for comparing the two models under the same conditions.

## Two models, one surprise

I assumed PubMedBERT would win. It's a domain-specific model trained on biomedical text. MiniLM is a general-purpose sentence transformer. On biomedical search, the specialist should beat the generalist. Right?

I ran both models through the evaluation harness early in the project, when the corpus was around 10,000 papers. At that scale, MiniLM had slightly better MeSH overlap in its top-10 results, while PubMedBERT returned higher raw cosine similarity scores. But higher similarity is a property of the embedding space, not retrieval quality. Two vectors can be "closer together" in one model's space without the results being more relevant. What matters is whether the right papers end up at the top of the list.

Based on those early results, I went with MiniLM for the production deployment. It was faster (384-dim vectors are cheaper to compare than 768-dim), and seemed at least as good at retrieval.

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

PubMedBERT wins on 5 out of 8 queries and ties on 2. The biggest gap is HIIT: 0.59 vs 0.89. The only query where MiniLM is better is vegetarian protein (0.97 vs 0.88). At 10K papers, the corpus was too sparse for PubMedBERT's domain knowledge to matter. At 40K, with denser topic clusters, the specialist model pulls ahead.

The lesson: don't evaluate at one corpus size and assume the results hold. Retrieval quality depends on what's in the index. A model that looks equivalent on a thin corpus can look very different on a thick one, because there are more borderline documents for it to rank correctly or incorrectly.

I'm keeping MiniLM in production for now. It's half the storage, faster to index and search, and 0.83 NDCG@5 is solid. But if I were optimizing for quality over cost, the data says PubMedBERT is the better model for this domain.

## Architecture

![Architecture diagram showing data flow from PubMed API through Airflow, Postgres with pgvector, FastAPI, and the MCP server](/blog/pubmed/architecture.svg)

The embedding pipeline forks across both models and rejoins at the evaluation stage:

![Embedding pipeline showing MiniLM and PubMedBERT paths, HNSW indexing, and MiniLM evaluation results](/blog/pubmed/pipeline.svg)

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

Some other queries that work well given the corpus: "gut microbiome and mental health," "effects of meditation on anxiety," "resistance training benefits for older adults," "sleep deprivation and cognitive performance."

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

The MCP server wraps the same API so that Claude (or any LLM that supports MCP) can call it directly as a tool. Instead of me copy-pasting queries and results back and forth, Claude can search the corpus, pull specific papers, and find related work on its own during a conversation.

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

And then it just works. Here's a real conversation. I ask a question, Claude calls the search tool on its own, reads the abstracts that come back, and gives me a grounded summary:

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

No copy-pasting, no switching tabs. Claude searches the corpus, reads the abstracts, and pulls out findings with PMIDs I can check. When I want to dig deeper into a paper, I ask and it calls `get_paper`. It's the most useful part of the project for my own day-to-day use.

## Making it better: fine-tuning, re-ranking, and inference optimization

With a working search engine and an evaluation harness, the next question is: how far can you push the quality without changing the underlying architecture?

### Contrastive fine-tuning

MiniLM is a general-purpose model. It's never seen biomedical text during training. Fine-tuning on PubMed abstracts could close the gap on domain-specific queries without hurting the ones that already work well.

I used contrastive learning with `MultipleNegativesRankingLoss` from sentence-transformers. The idea: given a pair of papers that are about the same topic, train the model to produce similar embeddings for them. Every other paper in the batch acts as an implicit negative. You don't need to explicitly mine hard negatives; the batch provides them for free.

The training data comes from MeSH term co-occurrence. Papers sharing at least two topic-relevant MeSH terms form positive pairs. I filtered out generic MeSH terms (demographics like "Humans" and "Female," study design terms like "Retrospective Studies," geographic terms like "United States") that don't indicate topical similarity. That gave me ~100K pairs from the 40K corpus.

One epoch, batch size 64, about 20 minutes on Apple Silicon.

| Query | Base | Fine-tuned | Delta |
|-------|------|-----------|-------|
| Creatine + muscle recovery | 1.00 | 1.00 | 0.00 |
| Quitting alcohol | 0.59 | 0.59 | 0.00 |
| HIIT benefits | 0.59 | 0.72 | +0.13 |
| Vegetarian protein | 0.97 | 0.97 | 0.00 |
| AI ethics in healthcare | 0.92 | 0.92 | 0.00 |
| Sleep deprivation + cognition | 0.68 | 0.86 | +0.19 |
| Gut microbiome + mental health | 0.87 | 0.87 | 0.00 |
| Resistance training for elderly | 1.00 | 1.00 | 0.00 |
| **Mean NDCG@5** | **0.83** | **0.86** | **+0.04** |

The gains are concentrated on the previously weakest queries. Sleep deprivation jumped from 0.68 to 0.86, HIIT from 0.59 to 0.72. The already-strong queries held steady. This is the best-case outcome: lift the floor without lowering the ceiling.

The MeSH pairing strategy matters more than training scale. Using topic-relevant MeSH terms (filtering out demographics, study design, geography) gives you pairs that actually share subject matter. Training on "both papers are about humans" would teach the model nothing.

### Cross-encoder re-ranking

Bi-encoders encode query and document independently. This is what makes them fast (pre-compute all document embeddings, then just encode the query at search time), but it means they can't model fine-grained interactions between query and document tokens. A cross-encoder takes the (query, document) pair as a single input and scores it jointly. More accurate, but you have to run it on every candidate.

The standard approach is a two-stage pipeline: bi-encoder retrieves a broad candidate set (top 50), cross-encoder re-ranks to the final result (top 10). The bi-encoder is the recall stage, the cross-encoder is the precision stage.

I fine-tuned `cross-encoder/ms-marco-MiniLM-L-6-v2` on ~20K (query, document, relevance_score) triples. Each MeSH term becomes a natural language query, papers with that term are positives (graded by how many additional MeSH terms they share), and papers without it are negatives.

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

HIIT went from 0.59 to a perfect 1.00. The cross-encoder is particularly good at sorting through borderline cases where the bi-encoder can't distinguish between "this paper mentions HIIT in passing" and "this paper is a systematic review of HIIT outcomes."

The cost is ~272ms of additional latency per query. For a search API that's acceptable. For autocomplete it wouldn't be.

### ONNX export and INT8 quantization

sentence-transformers loads the full PyTorch runtime for inference. For serving, that's unnecessary overhead. ONNX Runtime provides a lighter inference path, and INT8 quantization shrinks the model further by representing weights as 8-bit integers instead of 32-bit floats.

The export requires reimplementing mean pooling by hand, since sentence-transformers' pooling layer isn't part of the base transformer model that gets exported to ONNX. You export the transformer, then do the attention-mask-weighted mean and L2 normalization in numpy.

| Model | Mean latency | P95 latency |
|-------|-------------|-------------|
| PyTorch | 4.41ms | 5.12ms |
| ONNX FP32 | 1.46ms | 1.68ms |
| ONNX INT8 | 0.84ms | 0.97ms |

INT8 is 5.3x faster than PyTorch with only 0.017 NDCG@5 degradation. ONNX FP32 is lossless, meaning the pooling reimplementation is correct and the format conversion introduces no quality loss. The INT8 degradation is negligible.

### Knowledge distillation

PubMedBERT lost the retrieval comparison, but it still knows things about biomedical language that MiniLM doesn't. Distillation tries to capture that knowledge without the cost of PubMedBERT's larger architecture.

The idea: for each batch of paper texts, compute pairwise similarity matrices from both models. The teacher's (PubMedBERT) similarity distribution, after softmax, represents its view of which documents are related to which. Train the student (MiniLM) to reproduce that distribution via KL divergence. The student learns to rank documents the way the teacher would, but in 384 dimensions instead of 768.

Three epochs, batch size 32, temperature 2.0. About an hour on Apple Silicon.

| Query | Base | Distilled | Delta |
|-------|------|-----------|-------|
| Creatine + muscle recovery | 1.00 | 1.00 | 0.00 |
| Quitting alcohol | 0.59 | 0.55 | -0.04 |
| HIIT benefits | 0.59 | 0.78 | +0.19 |
| Vegetarian protein | 0.97 | 0.92 | -0.05 |
| AI ethics in healthcare | 0.92 | 1.00 | +0.08 |
| Sleep deprivation + cognition | 0.68 | 0.36 | -0.32 |
| Gut microbiome + mental health | 0.87 | 0.89 | +0.02 |
| Resistance training for elderly | 1.00 | 1.00 | 0.00 |
| **Mean NDCG@5** | **0.83** | **0.81** | **-0.02** |

A slight net regression. The distilled model picked up some of PubMedBERT's strengths (HIIT +0.19, AI ethics to perfect 1.00) but lost ground on other queries, particularly sleep deprivation (-0.32). The similarity-based KL divergence loss is a blunt instrument: it transfers the teacher's pairwise document relationships wholesale, without any notion of which relationships matter for retrieval.

Contrastive fine-tuning (NDCG@5 0.86) remains the better approach for this use case. It gives the model directed signal about what "relevant" means by using task-specific pairs. Distillation gives it the teacher's general notion of "similar," which isn't the same thing.

### Training from scratch

The last experiment: initialize from `bert-base-uncased` (a general language model with no sentence embedding training) and train a sentence embedding model from scratch on PubMed data. This gives full control over the architecture, pooling strategy, and training procedure.

Architecture: BERT transformer + mean pooling (768-dim output). Trained on 10K MeSH-based pairs with the same contrastive loss used for fine-tuning. One epoch, batch size 32.

The training converged (loss dropped to 1.17), but I couldn't properly evaluate it. The BERT model outputs 768-dim embeddings, and my Neon database (free tier, 512MB limit) was already full with 40K MiniLM embeddings at 384-dim. Storing another 40K embeddings at twice the size wasn't possible. A meaningful comparison requires both models' embeddings in the database so you can search against each one independently.

The training itself was also ~4x slower than MiniLM (bert-base has 110M parameters vs MiniLM's 22M). For a production search system, starting from a large base model only makes sense if you need that extra capacity and have the storage and compute budget to support it. MiniLM's smaller architecture is a better starting point: faster to train, smaller embeddings, cheaper to index and search.

## Production infrastructure

Once the search quality was solid, I focused on making the system more production-ready.

### Async DB and connection pooling

The initial API used psycopg2, a synchronous Postgres driver. Every database call blocked the event loop, which defeats the purpose of FastAPI being async. I replaced it with asyncpg and a connection pool (configurable min/max connections). All endpoints now use `async with pool.acquire() as conn`, and connections are returned to the pool automatically. The pool is created in FastAPI's lifespan handler and cleaned up on shutdown.

### Monitoring

Prometheus scrapes the API's `/metrics` endpoint every 15 seconds. A Grafana dashboard auto-provisions on startup with panels for request rate, per-endpoint breakdown, search latency, error rate, and model status. The dashboard definition lives in version control, so it survives container restarts.

### MLflow model registry

The embedding pipeline now registers models as versioned artifacts in MLflow after every training or evaluation run. A registry management script handles promotion: you tag a specific version with the `@production` alias, and the API picks it up on next model load. This means swapping models doesn't require a code deploy. The API tries the registry first and falls back to downloading from HuggingFace if no registry model is available.

### A/B testing

To compare models in production, I added traffic routing. Set `AB_TEST_MODEL` and `AB_TEST_TRAFFIC` as environment variables, and a configurable percentage of search traffic gets routed to the treatment model instead of the default. Each response includes which model actually served it. Per-model latency and request counts are tracked in the Prometheus metrics, and a `/ab-results` endpoint gives you a summary of the comparison. The routing only applies when users don't explicitly choose a model, so it's transparent to API consumers who are already specifying one.

## What I'd change

The API encodes queries inline on the same server that handles requests. At any real scale you'd want to separate that out. Even 50 hand-labeled query-document pairs would be more informative than the automated MeSH proxy. The proxy was good enough to pick a model and measure fine-tuning gains, but I wouldn't trust it for fine-grained evaluation of re-ranking quality.

Re-embedding 40K papers against a remote Postgres instance (Neon) took ~23 minutes because each row is an individual INSERT over the network. A bulk insert via `COPY` or multi-row VALUES would cut that to seconds.

## The stack

Here's every piece and what it does:

- **Airflow** schedules and runs the daily ingestion pipeline. It handles retries, backfills, and parallel task execution across the five MeSH categories.
- **sentence-transformers** (HuggingFace) generates the embeddings and handles fine-tuning. Contrastive fine-tuning, cross-encoder re-ranking, and knowledge distillation all build on this library. **ONNX Runtime** provides optimized inference for production serving.
- **PostgreSQL + pgvector** stores both the paper metadata and the embedding vectors. pgvector is an extension that adds vector column types and similarity search operators directly in Postgres, so you don't need a separate vector database.
- **FastAPI** serves the search API. It handles query encoding, vector search, and filtering in a single request. FastAPI auto-generates interactive API docs (the Swagger UI at `/docs`), which made it easy to test and share.
- **MLflow** tracks evaluation experiments and serves as a model registry. Models are registered as versioned artifacts after training, with alias-based promotion for zero-deploy model swaps.
- **MCP (Model Context Protocol)** is a protocol that lets LLMs call external tools. The MCP server wraps the search API so Claude can query PubMed directly during a conversation, run searches, pull papers, and summarize findings.
- **Prometheus + Grafana** for monitoring. Prometheus scrapes the API's metrics endpoint, Grafana auto-provisions a dashboard showing request rates, latency, errors, and model status.
- **Docker Compose** runs the full stack locally: Postgres, Airflow, MLflow, Prometheus, Grafana, and the API, all wired together. One `docker compose up` to get a working dev environment.
- **GitHub Actions** runs 28 tests on every push: API endpoint tests, embedding pipeline tests, ingestion logic tests.
- **Fly.io** hosts the production API. The container runs on a shared-CPU VM with 4GB RAM (enough to hold the MiniLM model in memory). **Neon** provides the production Postgres instance with pgvector enabled.

Live API: [pubmed-search.fly.dev](https://pubmed-search.fly.dev/docs)
Code: [github.com/chibanaryan/pubmed-ml-platform](https://github.com/chibanaryan/pubmed-ml-platform)

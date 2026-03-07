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

I went with MiniLM for the production deployment. It's faster (384-dim vectors are cheaper to compare than 768-dim), and the early evaluation suggested it was at least as good at retrieval. At the full 40K-paper corpus, it scores a mean NDCG@10 of 0.91 across my evaluation queries. Not bad for a general-purpose model on biomedical data.

The honest caveat: I never re-ran PubMedBERT at the full corpus size. Generating 768-dim embeddings for 40K papers takes a while, and by the time the backfill was done I'd already committed to MiniLM. So I can't make a clean apples-to-apples comparison at scale. The early results were suggestive, not conclusive.

My best guess at why MiniLM holds up: it was trained on a massive corpus of sentence pairs where it learned which sentences mean the same thing and which don't. PubMedBERT knows more about biomedical language, but knowing what a paper is about is a different skill than knowing which paper is *more* relevant than another. For retrieval, calibration might matter more than domain comprehension. I'd want a proper comparison to say that with any confidence, though.

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

## What I'd change

The sentence-transformers library loads the full PyTorch model at runtime. Exporting it to ONNX (a format optimized for inference rather than training) would cut both startup time and per-query latency. The API also encodes queries inline on the same server that handles requests, which you'd want to separate at any real scale. And even 50 hand-labeled query-document pairs would be more informative than the automated MeSH proxy. The proxy was good enough to pick a model, but I wouldn't trust it for fine-grained evaluation.

## The stack

Here's every piece and what it does:

- **Airflow** schedules and runs the daily ingestion pipeline. It handles retries, backfills, and parallel task execution across the five MeSH categories.
- **sentence-transformers** (HuggingFace) generates the embeddings. It wraps PyTorch models in an API that takes text in and gives vectors out. One line to encode a batch of abstracts.
- **PostgreSQL + pgvector** stores both the paper metadata and the embedding vectors. pgvector is an extension that adds vector column types and similarity search operators directly in Postgres, so you don't need a separate vector database.
- **FastAPI** serves the search API. It handles query encoding, vector search, and filtering in a single request. FastAPI auto-generates interactive API docs (the Swagger UI at `/docs`), which made it easy to test and share.
- **MLflow** tracks evaluation experiments. Every evaluation run logs its parameters, metrics, and results so I can compare models and track how scores change as the corpus grows.
- **MCP (Model Context Protocol)** is a protocol that lets LLMs call external tools. The MCP server wraps the search API so Claude can query PubMed directly during a conversation, run searches, pull papers, and summarize findings.
- **Docker Compose** runs the full stack locally: Postgres, Airflow, the API, all wired together. One `docker compose up` to get a working dev environment.
- **GitHub Actions** runs 28 tests on every push: API endpoint tests, embedding pipeline tests, ingestion logic tests.
- **Fly.io** hosts the production API. The container runs on a shared-CPU VM with 4GB RAM (enough to hold the MiniLM model in memory). **Neon** provides the production Postgres instance with pgvector enabled.

Live API: [pubmed-search.fly.dev](https://pubmed-search.fly.dev/docs)
Code: [github.com/chibanaryan/pubmed-ml-platform](https://github.com/chibanaryan/pubmed-ml-platform)

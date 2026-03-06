---
title: "New Game+"
description: "A quick intro — what I've been working on, where I'm headed, and why I made this site."
pubDate: 2026-03-06
tags: ["personal", "introduction"]
---

I figured it was time to have a place to write things down, so here we are.

## The thread through my career

Looking back, most of my work has been about building the data infrastructure that other systems depend on. At Yelp I spent five years building and scaling Kafka-based data pipelines that integrated internal databases with external platforms across sales and marketing. At Cruise, that shifted into ML infrastructure specifically, where I worked on scaling data generation pipelines for the primary AV trajectory planning model and migrating critical workflows to their internal ML platform. At Block, I built observability systems for compliance screening, including anomaly detection, Airflow ETL pipelines, and an MCP server that lets engineers query customer journeys through an LLM.

The common thread is production data systems at scale, but increasingly the interesting problems sit at the intersection of data infrastructure and ML. There's a growing need for engineers who can build the production pipelines, feature stores, and serving infrastructure that ML models depend on. That's the space I want to keep moving deeper into.

## What I'm focused on now

I'm most interested in ML platform and infrastructure engineering. The kind of work where you're building the systems that make ML models actually work in production: data ingestion, feature engineering, training pipelines, model serving, monitoring. My Master's at Georgia Tech was in Interactive Intelligence, which included coursework on machine learning, and my time at Cruise gave me firsthand experience with petabyte-scale training and evaluation systems for autonomous vehicles and working directly on improving MLE workflows. I want more of that.

On the agentic AI side, building an MCP server at Block gave me a front-row seat to how LLMs can plug into real production systems. Not chatbots, but actual tool orchestration against live data. I've been presenting on multi-agent development and agentic workflows internally, and it's the area where I see the most rapid change happening right now.

I've also become more deliberate about the "why" behind the work. I've seen enough companies up close to know that technical ambition and ethical purpose don't always coexist easily. I want to work on the frontier of what's possible with ML and AI infrastructure while also pushing toward something that genuinely promotes human flourishing. Those goals can be in tension, and I think being honest about that tension is more useful than pretending it doesn't exist.

## Outside of work

I play piano, guitar, and bass. I've played keys in a couple indie bands and have a background in classical piano (big Bach fan). I'm also a bit of a compulsive list-maker when it comes to media. I track and rank games, albums, films, books, and TV, which got out of hand enough that I built [AcclaimedVideoGames](https://www.acclaimedvideogames.com/) ([source](https://github.com/chibanaryan/acclaimed_video_games)), a Django/HTMX project that aggregates rankings from publications into unified lists of critically acclaimed games. I might share more on that here at some point.

## This site

Built with Astro and hosted on Cloudflare Pages. I wanted a place to write about what I'm working on. More to come.

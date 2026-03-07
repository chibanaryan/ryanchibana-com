---
title: "Letting Philosophers Argue Through LLMs"
description: "I contributed three new debate matchups to Silicon Symposium, a project that assigns philosophers to local LLMs and lets them go at it. Aquinas vs Hume on God. Early vs late Wittgenstein on language. Aristotle vs Nietzsche on ethics."
pubDate: 2026-03-07T18:00:00-05:00
tags: ["ai", "philosophy", "open-source"]
draft: false
---

In a philosophy class, there's a game you play. You pick two thinkers who fundamentally disagree, you imagine them in a room together, and you try to figure out what they'd actually say to each other. Not the textbook summary. The real thing, with all the rhetorical texture and mutual contempt intact.

Dima Timofeev, someone I enjoyed working with at Cruise, built a project called [Silicon Symposium](https://github.com/CuriousDima/silicon-symposium) that automates this. It assigns each philosopher to a different local LLM running through Ollama, gives them system prompts that capture their voice and key ideas, and lets them go back and forth in a terminal UI built with Rich. The original matchup was Nietzsche (via Gemma) vs Heidegger (via GPT-OSS). He posted it on LinkedIn and invited contributions.

I couldn't resist. Three matchups came to mind immediately, all chosen because the disagreements are real and deep:

## Aquinas vs Hume, on God

This is the cleanest collision in the history of philosophy. Aquinas believed God's existence could be demonstrated through reason alone. His Five Ways are careful, architectonic arguments that move step by step from observable facts about the world to a necessary first cause. Hume looked at arguments like these and saw sophisticated question-begging. All knowledge comes from experience, he argued, and metaphysical claims about necessary beings outstrip what experience can support. Every move Aquinas makes, Hume has a counter ready. Every counter Hume raises, Aquinas would say confuses the limits of *our* understanding with the limits of *what can be understood*.

The prompt setup gives Aquinas his methodical, step-by-step style ("I answer that...") and gives Hume his cheerful, devastating skepticism. Watching them go is like watching 500 years of philosophical argument compressed into a terminal window.

## Early Wittgenstein vs late Wittgenstein, on language

This one is stranger, because it's the same person arguing with himself across a thirty-year gap.

The early Wittgenstein of the *Tractatus* believed language was a logical picture of reality. Every meaningful proposition mirrors a possible state of affairs. The structure of language corresponds to the structure of the world. He was so confident he'd solved the fundamental problems of philosophy that he quit the field and went to teach elementary school in rural Austria.

He came back. The later Wittgenstein of *Philosophical Investigations* dismantled nearly everything his younger self had built. Meaning isn't picturing, it's use. Language doesn't have a single, hidden logical structure; it's a collection of overlapping "language games" embedded in forms of life. The private, crystalline certainty of the *Tractatus* gives way to something messier, more social, more human.

Having two different models play the two Wittgensteins produces something genuinely interesting. The early Wittgenstein's austere confidence clashing with the later Wittgenstein's patient, example-driven deconstruction of that confidence. It's a philosopher doing something almost nobody does: admitting he was wrong, and explaining exactly how.

## Aristotle vs Nietzsche, on ethics

Given what [I wrote recently about virtue ethics and AI alignment](/blog/ethics-on-neuraths-boat), this one felt mandatory.

Aristotle believed in a natural human good. The good life is the life of virtue exercised in accordance with reason. Virtues are objective excellences: courage, temperance, justice, practical wisdom. They're cultivated through practice in a community, and they enable human flourishing. It's grounded, moderate, and deeply social.

Nietzsche thought this was precisely the problem. Moral systems, including the Greek virtue tradition, are expressions of power relations and historical accident, not timeless truths. Aristotle's "moderation" is mediocrity. His "virtues" are just the values of one culture elevated to universal status. The highest human achievement isn't conformity to a pre-given standard but self-creation: the individual who breaks free of herd morality and affirms life in all its difficulty and contradiction.

The system prompt gives Aristotle his measured, pedagogical authority and gives Nietzsche his provocative intensity. What comes out is a real argument about whether ethics is discovered or invented, and whether the examined life is one of balance or one of radical self-overcoming.

## The implementation

The [original codebase](https://github.com/CuriousDima/silicon-symposium) was clean but hardcoded for Nietzsche vs Heidegger. To support multiple debates, I extracted the configuration into a `DebateConfig` dataclass and moved each matchup into its own module. The app now takes a CLI argument:

```bash
python app.py aquinas-vs-hume
python app.py early-vs-late-wittgenstein
python app.py aristotle-vs-nietzsche
```

The [PR is up](https://github.com/CuriousDima/silicon-symposium/pull/1). Both models (Gemma 3 27B and GPT-OSS 20B) run locally through Ollama, so the whole thing works offline on a laptop with enough RAM.

## What's actually interesting here

It's easy to dismiss this as a toy. Two LLMs roleplaying as dead philosophers. But something happens when you watch it run that's harder to wave away.

The models don't just recite positions. They respond to each other. They pick up on specific claims, challenge assumptions, press on weak points. They do this imperfectly, and they sometimes lose the thread or produce generic philosophy-class pablum. But often enough, they generate exchanges that would pass for a decent seminar discussion. Not because they understand philosophy, but because they've absorbed enough of how philosophical argument works to simulate it convincingly.

That gap between simulation and understanding is itself a philosophical question. Wittgenstein would have had something to say about it.

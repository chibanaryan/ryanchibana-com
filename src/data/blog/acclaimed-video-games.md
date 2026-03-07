---
title: "Building AcclaimedVideoGames"
description: "How a side project became a three-month engineering binge. Django, HTMX, and 875 commits later."
pubDate: 2026-03-07T20:00:00-05:00
tags: ["projects", "django", "web"]
draft: true
---

I'm always on the lookout for a good aggregated list of media. For any medium, games, films, albums, books, I want to know what the critics collectively think is worth my time. Most aggregation sites are shallow (averaged scores, reader polls), but AcclaimedVideoGames was different. It combines over 900 ranked lists from ~140 publications using a match-up based algorithm that actually handles the messiness of comparing ranked vs. unranked lists, platform-specific lists, and one-per-series restrictions. It was the most rigorous thing I'd found.

The creator was focused on the data side of the project — the ranking algorithm, the list curation, the statistical methodology — but didn't have the background to build a modern website for it. The site as it stood had been put together quickly by a friend, but that person could only commit a small amount of time, and eventually the project outgrew what had been built.

When I saw a post on the site looking for a web developer, I thought it was a thread worth pulling on. A fun project, real data, a stack I wanted to learn more about. I didn't anticipate how involved I'd get. I took over web development in November 2025, figured I'd clean some things up, maybe improve the frontend. Instead I ended up rewriting most of the site over the next three months. 875 commits.

It's at [acclaimedvideogames.com](https://www.acclaimedvideogames.com/) if you want to see it. The [source is on GitHub](https://github.com/chibanaryan/acclaimed_video_games).

## What I built

Django with server-side rendering, HTMX for dynamic interactions, Alpine.js for client-side reactivity, Tailwind CSS with DaisyUI, on Heroku with PostgreSQL. The previous version had a Vue.js SPA frontend, but I migrated to HTMX so the site could be archived by the Wayback Machine (it's an archival artifact of gaming history, after all) and because server-rendered HTML is a better fit for this kind of content-heavy site.

I ripped out Vue and Bulma, built a client-side filtering system backed by IndexedDB, added a Wikipedia genre pipeline (IGDB's taxonomy is too coarse, so I scrape and normalize genres from Wikipedia infoboxes), integrated HowLongToBeat playtime data, added user accounts with played/want-to-play tracking and saved filters, built developer hierarchy pages, and took test coverage from near zero to complete. I also found a lot of performance wins in the IGDB metadata refresh pipeline and reorganized the site layout to consolidate everything into a single rankings page with complex filtering that still feels digestible.
<video src="/blog/avg-demo.mp4" autoplay loop muted playsinline style="max-width:100%;height:auto;border-radius:6px;margin:1rem 0;"></video>

The parts I'm most proud of are the filter components. The year grid heatmap was inspired by RateYourMusic's year filter, but I wanted something more responsive and more visual. You can drag-select a range of years and the heatmap updates instantly to show where the games concentrate. The faceted counts on every filter option resort and update in real time as you narrow things down, so you always know how many games match before you click. And the rank distribution chart gives you a sense of how the filtered results are distributed across the full ranking, which makes the data feel alive rather than just being a list you scroll through.

<img src="/blog/avg-architecture.svg" alt="AcclaimedVideoGames architecture" class="diagram-thumb" />
<div class="diagram-overlay" onclick="this.style.display='none'">
<img src="/blog/avg-architecture.svg" alt="AcclaimedVideoGames architecture" />
</div>
<style>
.diagram-thumb { max-width:100%; margin:1rem 0; cursor:zoom-in; display:block; }
.diagram-overlay { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(250,247,242,0.97); z-index:999; cursor:zoom-out; padding:2rem; }
.diagram-overlay img { width:100%; height:100%; object-fit:contain; }
</style>
<script>
document.querySelector('.diagram-thumb').addEventListener('click', function() {
  this.nextElementSibling.style.display = 'block';
});
</script>

The creator handles the data side: curating lists, engineering the ranking algorithm, generating import files. I handle the site.

## Agentic engineering

Most of the commits were written with an AI coding agent. I was already doing agentic engineering at work, but a personal project with no design reviews or code review bottlenecks let me really test the limits of how fast you can go.

At one point I decided to do the crazy thing. I wrote a shell script that spun up eight git worktrees simultaneously, each with its own agent session in a VS Code terminal, all working on different parts of a major refactor to generalize the data model to support books. I gave an [internal presentation](/presentations/dr-claudelove-git-worktrees.pdf) about what I learned from the experience, titled "Dr. Claudelove, or: How I Learned to Stop Worrying and Love the Git Worktree."

Eight agents is too many. The worktrees drift apart, rebasing is constant, and there were moments where I didn't understand what any of them were doing and briefly considered throwing out tens of thousands of lines. I tried using [beads](https://github.com/steveyegge/beads) for issue tracking and coordination but probably fumbled the setup. Fell back to a single markdown PRD where agents claimed tasks and marked them done. Dedicating one agent to periodically review all the others' code and flag incompatibilities helped a lot.

In practice it felt closer to 4x than 8x. There's real wasted work. But the books refactor, rewriting tens of thousands of lines to extract a shared base model, abstract the templates, and build out a parallel books app, was done and correct within a couple of hours. The agents inferred which components should be broken out into a shared core versus kept app-specific, without that being in the PRD. Newer orchestration tools like Conductor are making this kind of coordination more manageable, but when I did it, it was mostly duct tape.

The thing that stuck with me: I stopped thinking of myself as someone who writes code and started thinking of myself as someone who coordinates agents that write code. You review intent, architecture, test outcomes, not individual lines. For a hobby project, that works. Adapting it to a professional context with real risk requirements is harder, and I don't think anyone has fully figured it out yet. One thing I didn't expect: having access to these tools makes leaping into a totally different tech stack feel easy. I learned Django by shipping with it, not by studying it first. You miss some of the details that way, but the feedback of real results keeps you motivated and learning in a way that tutorials never did.

## The Reddit post

We posted the project to [r/gaming](https://www.reddit.com/r/gaming/comments/1qwjkqe/i_collected_over_900_greatest_games_lists_and/) and it took off: 5,300 upvotes, 1,300 comments, and a 93.2% upvote ratio — which is wild for a ranked list that basically no one is going to fully agree with. People argued about which games were ranked too high or too low, which is exactly what you want. It also got some gaming press coverage and a streamer did a video going through the rankings.

It was cool to see something we'd been heads-down building for months actually get attention from people who saw the care we'd put into it — the data and the site.

## Why this project

I'm a compulsive list-maker. I track and rank games, albums, films, books, TV. AcclaimedVideoGames scratches the same itch but with data instead of personal opinion: what do the critics collectively think are the best games ever made?

It's also the most complete full-stack project I've shipped outside of work. I touched everything: backend, frontend, data pipelines, external APIs, auth, performance, deployment. At work you get hired for a slice. Here I had to do all of it.

There's something about having full ownership that makes the work addictive. No tickets, no sprint planning, just see a problem and fix it. There were nights I stayed up until 3am tinkering with it. When users reported bugs after the Reddit post, I often had them fixed within hours, sometimes minutes. That kind of iteration speed is hard to get anywhere else.

Throughout this process I realized I really love thinking about UX. How to let the user carry out their intent with the fewest possible interactions. How to display data beautifully and usefully. That ended up being the most satisfying part of the whole project.

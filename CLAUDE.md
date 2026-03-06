# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Ryan Chibana (ryanchibana.com), built with Astro 5 and deployed to Cloudflare Pages.

## Commands

- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Production build to `./dist/`
- `npm run preview` — Preview production build locally
- `npm run deploy` — Build and deploy to Cloudflare Pages via Wrangler
- `npm run cf-preview` — Build and preview with Wrangler Pages dev server

## Architecture

**Framework:** Astro 5 (static site, no UI framework integrations).

**Content system:** Blog posts are Markdown files in `src/data/blog/`. The collection is defined in `src/content.config.ts` using Astro's glob loader. Post frontmatter schema: `title`, `description`, `pubDate`, optional `updatedDate`, `draft`, `tags`, `heroImage`.

**Key directories:**
- `src/pages/` — File-based routing (index, about, blog, RSS)
- `src/layouts/` — `BaseLayout.astro` (site shell) and `BlogPost.astro` (article layout)
- `src/components/` — Shared components including `BaseHead.astro` (meta/SEO)
- `src/styles/global.css` — Global styles with CSS custom properties

**Blog routing:** `src/pages/blog/[...id].astro` generates static pages from the blog collection. The post's `id` (derived from the Markdown filename) becomes the URL slug.

**TypeScript:** Strict mode, extending `astro/tsconfigs/strict`.

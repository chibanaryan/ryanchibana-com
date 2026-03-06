---
title: "Building Interactive Visualizations on a Static Site"
description: "How I use Svelte wrappers and client:visible to lazy-load D3 and Three.js."
pubDate: 2026-03-06
tags: ["d3", "threejs", "svelte"]
---

One of the goals for this site was to include interactive data visualizations without sacrificing page load performance.

## The pattern

The approach is straightforward:

1. Write pure rendering logic in standalone TypeScript files
2. Wrap them in thin Svelte components for lifecycle management
3. Use Astro's `client:visible` directive to hydrate only when scrolled into view

## D3.js

The D3 chart uses modular imports (`d3-scale`, `d3-selection`, `d3-axis`) instead of the full bundle. This keeps the shipped JavaScript small while still giving full control over the visualization.

## Three.js

The Three.js scene creates a WebGL context only when the component enters the viewport. A static fallback image is shown until then, so users on slow connections still see something meaningful.

## Result

Pages without visualizations ship zero JavaScript. Pages with them only load what's needed, and only when the user scrolls to it.

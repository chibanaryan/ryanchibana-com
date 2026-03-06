<script lang="ts">
  import { onMount } from 'svelte';

  let container: HTMLDivElement;

  onMount(async () => {
    const { bindChart } = await import('./d3-bindChart');
    bindChart(container, [
      { label: 'Astro', value: 92 },
      { label: 'Svelte', value: 85 },
      { label: 'D3', value: 78 },
      { label: 'Three.js', value: 70 },
      { label: 'Alpine', value: 65 },
    ]);
  });
</script>

<div bind:this={container} class="chart-container"></div>

<style>
  .chart-container {
    width: 100%;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';

  let container: HTMLDivElement;
  let loaded = $state(false);

  onMount(async () => {
    const { createScene } = await import('./three-createScene');
    const cleanup = createScene(container);
    loaded = true;
    return cleanup;
  });
</script>

<div class="scene-wrapper">
  {#if !loaded}
    <div class="fallback">
      <p>Loading 3D scene...</p>
    </div>
  {/if}
  <div bind:this={container} class="scene-container"></div>
</div>

<style>
  .scene-wrapper {
    position: relative;
    width: 100%;
  }

  .fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 5 / 3;
    max-height: 400px;
    background: #f0f0f0;
    border-radius: 6px;
    color: #888;
    font-size: 0.9rem;
  }

  .scene-container {
    width: 100%;
    border-radius: 6px;
    overflow: hidden;
  }
</style>

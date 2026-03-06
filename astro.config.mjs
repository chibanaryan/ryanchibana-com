// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import alpinejs from '@astrojs/alpinejs';

export default defineConfig({
  site: 'https://ryanchibana.com',
  integrations: [
    svelte(),
    alpinejs({ entrypoint: '/src/entrypoint' }),
  ],
});

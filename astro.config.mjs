// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// El `site` se usa para generar URLs absolutas canónicas y el sitemap.
// Apunta al dominio actual de Cloudflare (Worker); cámbialo si registras un dominio propio.
export default defineConfig({
  site: 'https://semanasantaopendata.jaguerra27.workers.dev',
  trailingSlash: 'always',
  integrations: [sitemap()],
});

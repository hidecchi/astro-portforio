// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  server: {
    host: true, // 同一LAN内のスマホ等からアクセス可能にする
  },
});

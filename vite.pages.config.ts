import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./static',import.meta.url)),
  base: '/style_lens/',
  publicDir: fileURLToPath(new URL('./public',import.meta.url)),
  plugins:[react()],
  resolve:{alias:{'@':fileURLToPath(new URL('./',import.meta.url))}},
  define:{'process.env.NEXT_PUBLIC_API_ORIGIN':JSON.stringify('https://stylelens-design-guide.leejinho970715.chatgpt.site'),'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify('/style_lens/')},
  build:{outDir:fileURLToPath(new URL('./pages-dist',import.meta.url)),emptyOutDir:true},
});

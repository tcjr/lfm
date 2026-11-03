import { defineConfig } from 'vite';
import { ember } from '@nullvoxpopuli/ember-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [ember(), tailwindcss()],
});

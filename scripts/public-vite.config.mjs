import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Standalone client build: no server framework, account, secret, or connector. */
export function publicConfig(outDir = resolve(projectRoot, 'dist')) {
  const hand = `data:image/webp;base64,${readFileSync(resolve(projectRoot, 'public/drawing-hand-hd.webp')).toString('base64')}`;
  const voice = `data:audio/wav;base64,${readFileSync(resolve(projectRoot, 'public/original-voice.wav')).toString('base64')}`;
  const favicon = `data:image/svg+xml;base64,${readFileSync(resolve(projectRoot, 'public/favicon.svg')).toString('base64')}`;
  return {
    configFile: false,
    root: resolve(projectRoot, 'scripts/public-app'),
    publicDir: false,
    base: './',
    plugins: [
      react(),
      {name: 'embedded-favicon', transformIndexHtml: {order: 'pre', handler: html => html.replace('__TRAIT_FAVICON__', favicon)}},
    ],
    resolve: {alias: {'@': projectRoot}},
    define: {__TRAIT_HD_HAND_ASSET__: JSON.stringify(hand), __TRAIT_ORIGINAL_AUDIO_ASSET__: JSON.stringify(voice)},
    css: {postcss: {plugins: [tailwind({base: resolve(projectRoot, 'app')})]}},
    build: {
      outDir,
      emptyOutDir: true,
      modulePreload: false,
      cssCodeSplit: false,
      sourcemap: false,
      assetsInlineLimit: 10_000_000,
      // The photographic hand and short original recordings work offline too.
      chunkSizeWarningLimit: 3000,
      rolldownOptions: {output: {codeSplitting: false}},
    },
    server: {host: '127.0.0.1', port: 5173},
    preview: {host: '127.0.0.1', port: 4173},
  };
}

export default defineConfig(() => publicConfig());

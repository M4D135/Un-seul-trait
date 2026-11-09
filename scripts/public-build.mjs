import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {relative, resolve, sep} from 'node:path';
import {build} from 'vite';
import {projectRoot, publicConfig} from './public-vite.config.mjs';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out')) {
  throw new Error('Usage: node scripts/public-build.mjs [--out dossier]');
}
const outDir = resolve(projectRoot, args[1] ?? 'work/public-dist');
const destination = relative(projectRoot, outDir);
const first = destination.split(sep)[0];
if (!destination || !['dist','work','outputs'].includes(first) || destination === 'work' || destination === 'outputs') {
  throw new Error('Choisis un dossier de sortie séparé des sources.');
}

await build(publicConfig(outDir));
let html = await readFile(resolve(outDir, 'index.html'), 'utf8');
const credits = {
  project: await readFile(resolve(projectRoot, 'CREDITS.md'), 'utf8'),
  dependencies: await readFile(resolve(projectRoot, 'docs/THIRD-PARTY-NOTICES.md'), 'utf8'),
  media: {
    hand: JSON.parse(await readFile(resolve(projectRoot, 'public/drawing-hand-hd-manifest.json'), 'utf8')),
    voice: JSON.parse(await readFile(resolve(projectRoot, 'public/original-voice-manifest.json'), 'utf8')),
  },
};
const notices = JSON.stringify(credits).replace(/</g, '\\u003c');
html = html.replace('</body>', () => `<script type="application/json" id="un-seul-trait-credits">${notices}</script>\n</body>`);
await writeFile(resolve(outDir, 'index.html'), html);
const readAsset = async url => {
  if (/^(?:https?:|data:|\/\/)/.test(url)) throw new Error(`Dépendance externe inattendue dans le build: ${url.slice(0, 80)}`);
  const path = resolve(outDir, url.replace(/^\.\//, ''));
  if (relative(outDir, path).startsWith('..')) throw new Error('Chemin de ressource hors du build.');
  return readFile(path, 'utf8');
};

for (const match of [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)]) {
  const javascript = (await readAsset(match[1])).replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], () => `<script type="module">${javascript}</script>`);
}
for (const match of [...html.matchAll(/<link\b[^>]*>/gi)]) {
  if (/\brel=["']modulepreload["']/i.test(match[0])) {
    html = html.replace(match[0], '');
    continue;
  }
  if (!/\brel=["']stylesheet["']/i.test(match[0])) continue;
  const url = match[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (!url) throw new Error('Feuille de style sans URL.');
  const css = (await readAsset(url)).replace(/<\/style/gi, '<\\/style');
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
  .replace(/(<style\b[^>]*>)[\s\S]*?<\/style>/gi, '$1</style>');
if (/<script\b[^>]*\bsrc=|<link\b[^>]*\brel=["'](?:stylesheet|modulepreload)["']/i.test(markup)) {
  throw new Error('Le fichier hors ligne contient encore une ressource externe.');
}
await writeFile(resolve(outDir, 'offline-play.html'), html);
await writeFile(resolve(outDir, '.nojekyll'), '');
await copyFile(resolve(projectRoot, 'CREDITS.md'), resolve(outDir, 'CREDITS.md'));
await mkdir(resolve(outDir, 'docs'), {recursive: true});
await copyFile(resolve(projectRoot, 'docs/THIRD-PARTY-NOTICES.md'), resolve(outDir, 'docs/THIRD-PARTY-NOTICES.md'));
for (const name of ['drawing-hand-hd-manifest.json','original-voice-manifest.json']) {
  await copyFile(resolve(projectRoot, 'public', name), resolve(outDir, 'docs', name));
}
console.log(`\nJeu statique : ${resolve(outDir, 'index.html')}`);
console.log(`Fichier autonome : ${resolve(outDir, 'offline-play.html')}`);

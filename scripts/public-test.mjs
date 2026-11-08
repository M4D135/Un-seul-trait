import {mkdtemp, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, relative, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
async function visit(directory) {
  let entries;
  try {entries = await readdir(directory, {withFileTypes: true});}
  catch (error) {if (error.code === 'ENOENT') return; throw error;}
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (/\.(?:test|spec)\.tsx?$/.test(entry.name)) files.push(path);
  }
}
await visit(resolve(root, 'tests'));
if (!files.length) {
  console.log('Aucun test autonome dans tests/.');
} else {
  const temporary = await mkdtemp(resolve(tmpdir(), 'un-seul-trait-tests-'));
  try {
    await writeFile(resolve(temporary, 'package.json'), '{"type":"commonjs"}\n');
    const compile = spawnSync(process.execPath, [
      resolve(root, 'node_modules/typescript/bin/tsc'), '--strict', '--target', 'ES2022',
      '--lib', 'ES2022,DOM,DOM.Iterable', '--module', 'CommonJS', '--moduleResolution', 'Node',
      '--esModuleInterop', '--skipLibCheck', '--types', 'node', '--rootDir', root,
      '--outDir', temporary, ...files.sort(),
    ], {cwd: root, stdio: 'inherit'});
    if (compile.error) throw compile.error;
    if (compile.status !== 0) process.exitCode = compile.status ?? 1;
    else {
      const compiled = files.map(path => resolve(temporary, relative(root, path).replace(/\.tsx?$/, '.js')));
      const result = spawnSync(process.execPath, ['--test', ...compiled], {cwd: temporary, stdio: 'inherit'});
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    }
  } finally {await rm(temporary, {recursive: true, force: true});}
}

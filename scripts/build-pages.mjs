import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
for (const args of [
  [path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'],
  [path.join(root, 'scripts/fix-static-export.mjs')],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

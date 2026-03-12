import fs from 'fs';
import path from 'path';
import { loadEnvFile } from './env.js';
import { listRemoteDirectories } from './s3_utils.js';

loadEnvFile();

const failedPath = './failed.txt';
if (!fs.existsSync(failedPath)) {
  console.log('No failed.txt file found.');
  process.exit(0);
}

const lines = fs.readFileSync(failedPath, 'utf-8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (lines.length === 0) {
  console.log('failed.txt is already empty.');
  process.exit(0);
}

const byModule = new Map();
for (const line of lines) {
  const [modulePath, version, ...rest] = line.split(/\s+/);
  if (!modulePath || !version || rest.length > 0) {
    console.warn(`Skipping malformed line: "${line}"`);
    continue;
  }
  const set = byModule.get(modulePath) ?? new Set();
  set.add(version);
  byModule.set(modulePath, set);
}

const staleEntries = new Set();
for (const [modulePath, versions] of byModule.entries()) {
  const remoteVersions = listRemoteDirectories(modulePath);
  for (const version of versions) {
    const localVersionDir = path.join('./docs', modulePath, version);
    if (remoteVersions.has(version) || fs.existsSync(localVersionDir)) {
      staleEntries.add(`${modulePath} ${version}`);
    }
  }
}

const updated = lines.filter((line) => !staleEntries.has(line));
if (updated.length === lines.length) {
  console.log('No stale failed entries found.');
  process.exit(0);
}

fs.writeFileSync(failedPath, `${updated.join('\n')}${updated.length ? '\n' : ''}`);
console.log(`Removed ${lines.length - updated.length} stale failed entries.`);

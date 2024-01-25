import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock execSync for testing
// function execSync(cmd) {
//   console.log(cmd);
//   return { stdout: '', stderr: '' };
// }

const rootDir = './docs';
const remoteRoot = 's3://stirante.com/script/';

// Copy all files in rootDir with `aws s3 cp`
const files = fs.readdirSync(rootDir);
for (const file of files) {
  const filePath = path.join(rootDir, file);
  if (fs.statSync(filePath).isDirectory()) {
    processDocDir(filePath);
    continue;
  }
  copy(filePath, file);
}

function processDocDir(dir) {
  const versions = fs.readdirSync(dir);
  for (const version of versions) {
    const versionPath = path.join(dir, version);
    const relativePath = path.relative(rootDir, versionPath);
    const stat = fs.statSync(versionPath);
    // If it is a directory and modification time is within last 24 hours
    if (stat.isDirectory() && stat.mtimeMs > Date.now() - 24 * 60 * 60 * 1000) {
      sync(versionPath, relativePath);
      continue;
    } else if (stat.isDirectory()) {
      continue;
    }
    copy(versionPath, relativePath);
  }
}

function copy(local, remote) {
  const fixed = remote.replaceAll('\\', '/').replaceAll('//', '/');
  console.log(`Uploading ${fixed}`);
  execSync(`aws s3 cp ${local} ${remoteRoot}${fixed}`, { stdio: 'pipe' });
}

function sync(local, remote) {
  const fixed = remote.replaceAll('\\', '/').replaceAll('//', '/');
  console.log(`Syncing ${fixed}`);
  execSync(`aws s3 sync ${local} ${remoteRoot}${fixed}`, { stdio: 'pipe' });
}
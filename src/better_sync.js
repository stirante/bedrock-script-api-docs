import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Load environment variables from .env if present without overriding existing values.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const rawLine of envContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const cloudfrontDistributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID?.trim();
let missingDistributionLogged = false;

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
    // If it is a directory and modification time is within last 1 hour
    if (stat.isDirectory() && stat.mtimeMs > Date.now() - 1 * 60 * 60 * 1000) {
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
  if (!cloudfrontDistributionId) {
    if (!missingDistributionLogged) {
      console.warn('CLOUDFRONT_DISTRIBUTION_ID is not set; skipping CloudFront invalidation.');
      missingDistributionLogged = true;
    }
    return;
  }

  const invalidationPath = `/${fixed.replace(/^\/+/, '')}`;
  console.log(`Invalidating ${invalidationPath}`);
  execSync(
    `aws cloudfront create-invalidation --distribution-id ${cloudfrontDistributionId} --paths "${invalidationPath}"`,
    { stdio: 'pipe' },
  );
}

function sync(local, remote) {
  const fixed = remote.replaceAll('\\', '/').replaceAll('//', '/');
  console.log(`Syncing ${fixed}`);
  execSync(`aws s3 sync ${local} ${remoteRoot}${fixed}`, { stdio: 'pipe' });
}

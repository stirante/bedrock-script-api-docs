import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { loadEnvFile } from './env.js';
import { listRemoteDirectories, s3Path, s3PrefixPath } from './s3_utils.js';

loadEnvFile();

const isDryRun = process.argv.includes('--dry-run');
const moduleFilesOnly = process.argv.includes('--module-files-only');
const cloudfrontDistributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID?.trim();
let missingDistributionLogged = false;

const rootDir = './docs';
const alwaysUpload = ['index.html', 'style.css', 'diff.html', 'diff.json'];
const awsRegion = (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1').trim();
const awsEnv = {
  ...process.env,
  AWS_REGION: awsRegion,
  AWS_DEFAULT_REGION: awsRegion
};

if (!fs.existsSync(rootDir)) {
  if (isDryRun) {
    console.log(`[DRY] Missing ${rootDir}; nothing to upload.`);
    process.exit(0);
  }
  throw new Error(`Missing ${rootDir}. Run "npm run build" first.`);
}

const files = fs.readdirSync(rootDir, { withFileTypes: true });
for (const file of files) {
  const filePath = path.join(rootDir, file.name);
  if (file.isDirectory()) {
    uploadMissingVersions(filePath, file.name);
    continue;
  }
  if (alwaysUpload.includes(file.name)) {
    copy(filePath, file.name);
  }
}

function uploadMissingVersions(localModuleDir, modulePath) {
  const remoteVersions = moduleFilesOnly ? new Set() : listRemoteDirectories(modulePath);
  const entries = fs.readdirSync(localModuleDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      if (entry.name.endsWith('.html')) {
        copy(path.join(localModuleDir, entry.name), `${modulePath}/${entry.name}`);
      }
      continue;
    }

    if (moduleFilesOnly) {
      continue;
    }

    if (remoteVersions.has(entry.name)) {
      continue;
    }

    const localVersionPath = path.join(localModuleDir, entry.name);
    sync(localVersionPath, `${modulePath}/${entry.name}`);
  }
}

function copy(local, remote) {
  const fixed = remote.replaceAll('\\', '/').replaceAll('//', '/');
  const remoteUrl = s3Path(fixed);
  if (isDryRun) {
    console.log(`[DRY] Upload ${local} -> ${remoteUrl}`);
    return;
  }
  console.log(`Uploading ${fixed}`);
  execFileSync('aws', ['s3', 'cp', local, remoteUrl], { stdio: 'pipe', env: awsEnv });
  if (!cloudfrontDistributionId) {
    if (!missingDistributionLogged) {
      console.warn('CLOUDFRONT_DISTRIBUTION_ID is not set; skipping CloudFront invalidation.');
      missingDistributionLogged = true;
    }
    return;
  }

  const invalidationPath = `${s3PrefixPath()}/${fixed.replace(/^\/+/, '')}`.replaceAll('//', '/');
  console.log(`Invalidating ${invalidationPath}`);
  execFileSync('aws', ['cloudfront', 'create-invalidation', '--distribution-id', cloudfrontDistributionId, '--paths', invalidationPath], { stdio: 'pipe', env: awsEnv });
}

function sync(local, remote) {
  const fixed = remote.replaceAll('\\', '/').replaceAll('//', '/');
  const remoteUrl = s3Path(fixed);
  if (isDryRun) {
    console.log(`[DRY] Sync ${local} -> ${remoteUrl}`);
    return;
  }
  console.log(`Syncing ${fixed}`);
  execFileSync('aws', ['s3', 'sync', local, remoteUrl], { stdio: 'pipe', env: awsEnv });
}

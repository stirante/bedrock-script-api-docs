import { execFileSync } from 'child_process';
let missingAwsCliLogged = false;

function normalizePart(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

function resolveAwsRegion() {
  return (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1').trim();
}

function awsCliEnv() {
  const region = resolveAwsRegion();
  return {
    ...process.env,
    AWS_REGION: region,
    AWS_DEFAULT_REGION: region
  };
}

function getS3Config() {
  const bucket = (process.env.S3_DOCS_BUCKET || 'stirante.com').trim();
  const prefix = normalizePart((process.env.S3_DOCS_PREFIX || 'script').trim());
  return { bucket, prefix };
}

function toS3Url(...parts) {
  const { bucket, prefix } = getS3Config();
  const normalizedParts = [prefix, ...parts]
    .filter(Boolean)
    .map((part) => normalizePart(String(part)));
  return `s3://${bucket}/${normalizedParts.join('/')}`;
}

export function listRemoteDirectories(...parts) {
  const path = `${toS3Url(...parts)}/`;
  try {
    const output = execFileSync('aws', ['s3', 'ls', path], {
      encoding: 'utf-8',
      env: awsCliEnv(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const items = output
      .split(/\r?\n/)
      .map((line) => line.match(/PRE (.+)\/$/)?.[1])
      .filter(Boolean);
    return new Set(items);
  } catch (err) {
    if (err?.code === 'ENOENT') {
      if (!missingAwsCliLogged) {
        console.warn('AWS CLI is not installed or not in PATH. Install it to enable S3 listing/upload.');
        missingAwsCliLogged = true;
      }
      throw new Error('AWS CLI is not installed or not in PATH.');
    }

    const stderr = String(err?.stderr || '');
    if (stderr.includes('Unable to locate credentials')) {
      throw new Error('AWS credentials are not configured for S3 listing.');
    }

    throw new Error(`Failed to list remote path ${path}: ${err.message}`);
  }
}

export function s3Path(...parts) {
  return toS3Url(...parts);
}

export function s3PrefixPath() {
  const { prefix } = getS3Config();
  return prefix ? `/${prefix}` : '';
}

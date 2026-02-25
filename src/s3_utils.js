import { execFileSync } from 'child_process';
let missingAwsCliLogged = false;

function normalizePart(value) {
  return value.replace(/^\/+|\/+$/g, '');
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
    const output = execFileSync('aws', ['s3', 'ls', path], { encoding: 'utf-8' });
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
      return new Set();
    }
    console.warn(`Failed to list remote path ${path}: ${err.message}`);
    return new Set();
  }
}

export function s3Path(...parts) {
  return toS3Url(...parts);
}

export function s3PrefixPath() {
  const { prefix } = getS3Config();
  return prefix ? `/${prefix}` : '';
}

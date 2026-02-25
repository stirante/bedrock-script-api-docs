# bedrock-script-api-docs

This repository contains the code for generating the Bedrock Script API documentation.

This code optimally should be run incrementally, because it skips any packages that have already been processed and processing all packages takes a long time.

## Prerequisites

- [Node.js](https://nodejs.org/en/)
- [AWS CLI](https://aws.amazon.com/cli/)

## Setup

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Configure environment variables:
   - Local: copy `.env.example` to `.env` and fill values.
   - CI (GitHub Actions): set repository secrets/vars.

## Usage

### Building the documentation

Run `npm run build` to build the documentation.
The build now checks S3 (`aws s3 ls`) and generates only versions that are missing remotely.
Use `npm run build:dry` to preview which `module version` entries would be generated and uploaded.

### Uploading the documentation

Run `npm run sync` to upload only missing versions to S3.
Static files (`index.html`, `style.css`, `diff.html`, `diff.json`, module `index.html`) are always refreshed.
Use `npm run sync:dry` to preview exact S3 upload operations.

### Building and uploading the documentation

Run `npm run all` to build and upload the documentation. This will build the documentation and upload it to the bucket.
Use `npm run all:dry` for a full dry-run.

### Failed versions and retry

Failed versions are stored in `failed.txt`.
To retry a version locally, remove its line from `failed.txt` and run `npm run build` again.

### Required env vars

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

### Optional env vars

- `S3_DOCS_BUCKET` (default: `stirante.com`)
- `S3_DOCS_PREFIX` (default: `script`)
- `CLOUDFRONT_DISTRIBUTION_ID`

## Contributing

The code is a mess. If you want to contribute, please do. I will gladly accept any pull requests that improve the code quality.

My only request is to describe what you changed in the pull request description so that I don't have to dig through changes just to know what that change does.

# bedrock-script-api-docs

This repository contains the code for generating the Bedrock Script API documentation.

This code optimally should be run incrementally, because it skips any packages that have already been processed and processing all packages takes a long time.

## Prerequisites

- [Node.js](https://nodejs.org/en/)
- [AWS CLI](https://aws.amazon.com/cli/)

## Setup

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Configure the AWS CLI with your credentials.
4. Change the bucket in `package.json` to the bucket you want to upload the documentation to.

## Usage

### Building the documentation

Run `npm run build` to build the documentation. This will generate a `docs` folder containing the documentation.

### Uploading the documentation

Run `npm run sync` to upload the documentation to the bucket. This will upload the `docs` folder to the bucket.

### Building and uploading the documentation

Run `npm run all` to build and upload the documentation. This will build the documentation and upload it to the bucket.

## Contributing

The code is a mess. If you want to contribute, please do. I will gladly accept any pull requests that improve the code quality.

My only request is to describe what you changed in the pull request description so that I don't have to dig through changes just to know what that change does.
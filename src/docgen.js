import { createGunzip } from 'zlib';
import { extract } from 'tar';
import fetch from 'node-fetch';
import { exec, execSync } from 'child_process';
import fs from 'fs';
import { copyFolderSync } from './file_utils.js';
import { generateStructure } from './structure_gen.js';
import { fetchNpmPackageVersion } from './npm_utils.js';

function generateTypeDoc(path, url, version, failed) {
  return fetch(url)
    .then((response) => {
      // Clear tmp folder, extract tarball and copy tsconfig.json
      // tsconfig.json was painfully created through trial and error to make typedoc work.
      return new Promise((resolve, reject) => {
        fs.rmSync('./tmp', { recursive: true, force: true });
        fs.mkdirSync('./tmp');
        response.body
          .pipe(createGunzip())
          .pipe(extract({ cwd: './tmp' }))
          .on('error', (err) => {
            reject(err);
          })
          .on('finish', () => {
            fs.copyFileSync('./tsconfig.json.template', './tmp/package/tsconfig.json');
            let p = JSON.parse(fs.readFileSync('./tmp/package/package.json', 'utf8'));
            // Remove ^ from all dependencies
            for (let dep in p.dependencies) {
              p.dependencies[dep] = p.dependencies[dep].replace('^', '');
            }
            fs.writeFileSync('./tmp/package/package.json', JSON.stringify(p, null, 2));
            resolve();
          });
      });
    })
    .then(() => {
      return new Promise((resolve, reject) => {
        // Following commands were created through trial, error and frustration.
        // Still throws some errors and warnings, but it works (mostly).
        execSync('npm install', { cwd: './tmp/package' });
        const child = exec('npx typedoc --out ./docs --hideGenerator --searchInComments --entryPoints ./index.d.ts ./tsconfig.json', { cwd: './tmp/package' }, (err, stdout, stderr) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
      });
    })
    // Copy the generated docs to the docs folder.
    .then(() => {
      copyFolderSync('./tmp/package/docs', `./docs/${path}/${version}`);
      try {
      let struct = generateStructure(fs.readFileSync('./tmp/package/index.d.ts', 'utf8'));
      fs.writeFileSync(`./docs/${path}/${version}/structure.json`, JSON.stringify(struct));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to generate structure.json for ${path} ${version}`);
      }
    })
    .catch((err) => {
      console.error(err);
      // If it fails, add it to the failed list and never try again.
      if (failed.indexOf(path + ' ' + version) === -1) {
        failed.push(path + ' ' + version);
      }
    });
}

async function generateOnlyStructure(path, name, version) {
  console.log(`Generating structure.json for ${path} ${version}`);
  await fetchNpmPackageVersion(name, version)
    .then(([data, version]) => {
      return fetch(data.dist.tarball)
    })
    .then((response) => {
      // Clear tmp folder and extract tarball
      return new Promise((resolve, reject) => {
        fs.rmSync('./tmp', { recursive: true, force: true });
        try {
          fs.mkdirSync('./tmp');
        } catch (err) {
          // Ignore
        }
        response.body
          .pipe(createGunzip())
          .pipe(extract({ cwd: './tmp' }))
          .on('error', (err) => {
            reject(err);
          })
          .on('finish', () => {
            resolve();
          });
      });
    })
    .then(() => {
      try {
        let struct = generateStructure(fs.readFileSync('./tmp/package/index.d.ts', 'utf8'));
        fs.writeFileSync(`./docs/${path}/${version}/structure.json`, JSON.stringify(struct));
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to generate structure.json for ${path} ${version}`);
      }
    })
}

export { generateTypeDoc, generateOnlyStructure };
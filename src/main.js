import fs from 'fs';
import path from 'path';
import { compareVersions } from './sort_utils.js';
import { fetchNpmPackage, fetchNpmPackageVersion } from './npm_utils.js';
import { generateTypeDoc } from './docgen.js';

// List of packages to generate docs for.
const packages = [
  {
    name: '@minecraft/server',
    path: 'server'
  },
  {
    name: '@minecraft/server-ui',
    path: 'server-ui'
  },
  {
    name: '@minecraft/server-gametest',
    path: 'server-gametest'
  },
  {
    name: '@minecraft/server-editor',
    path: 'server-editor'
  },
  {
    name: '@minecraft/server-net',
    path: 'server-net'
  },
  {
    name: '@minecraft/server-admin',
    path: 'server-admin'
  }
]

// A list of failed packages. If a package fails to generate docs, it will be added to this list and never tried again.
let failed = [];
if (fs.existsSync('./failed.txt')) {
  failed = fs.readFileSync('./failed.txt', 'utf-8').split('\n');
}

// Generate the main index.html file
let fullIndex = `<html>
    <head>
        <title>Minecraft Script API</title>
        </head>
        <body>
            <h1>Minecraft <span style="text-decoration: line-through;">Scripting</span> Script API</h1>`

for (const p of packages) {
  let pack = await fetchNpmPackage(p.name);
  for (const version in pack.versions) {
    // Skip deprecated versions
    if (pack.versions[version].deprecated) {
      continue;
    }
    // Skip if the docs already exist
    if (fs.existsSync(`./docs/${p.path}/${version}`)) {
      continue;
    }
    // Skip if it failed before
    if (failed.indexOf(p.path + ' ' + version) !== -1) {
      continue;
    }
    // Download the tarball and generate the docs
    await fetchNpmPackageVersion(p.name, version)
      .then(([data, version]) => {
        const url = data.dist.tarball;
        return generateTypeDoc(p.path, url, version, failed);
      });
  }
  
  // Generate the index.html file for a package
  let availableVersions = fs.readdirSync('./docs/' + p.path).filter((file) => {
    return fs.statSync(`./docs/${p.path}/${file}`).isDirectory();
  }).sort(compareVersions)
    .reverse()
    .map((file) => {
      file = path.basename(file);
      return `<li><a href="/script/${p.path}/${file}/index.html">${file}</a></li>`;
    }).join('\n');
  
  let index = `<html>
      <head>
          <title>${p.name} API</title>
          </head>
          <body>
              <h1>${p.name} API</h1>
              <ul>
                  ${availableVersions}
              </ul>
          </body>
      </html>`;
  fs.writeFileSync(`./docs/${p.path}/index.html`, index);
  fullIndex += `<h2><a href="/script/${p.path}/index.html">${p.name}</a></h2>\n`;
}

fullIndex += `
</body>
</html>`;

// Write the main index.html file
fs.writeFileSync('./docs/index.html', fullIndex);

// Write the failed packages file
fs.writeFileSync('./failed.txt', failed.join('\n'));
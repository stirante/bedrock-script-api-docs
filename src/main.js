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
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header class="tsd-page-toolbar">
        <div class="tsd-toolbar-contents container">
            <div id="tsd-search" class="table-cell">
                <span class="title" style="font-weight: bold;">Minecraft Script API</span>
            </div>
        </div>
    </header>
    <div class="container container-main">
        <div class="tsd-panel">
            <ul>`

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
        <title>${p.name}</title>
        <link rel="stylesheet" href="../style.css">
    </head>
    <body>
        <header class="tsd-page-toolbar">
            <div class="tsd-toolbar-contents container">
                <div id="tsd-search" class="table-cell">
                    <span class="title" style="font-weight: bold;">${p.name}</span>
                </div>
            </div>
        </header>
        <div class="container container-main">
            <div class="tsd-panel">
                <ul>
                ${availableVersions}
                </ul>
            </div>
        </body>
    </div>
</html>`
  fs.writeFileSync(`./docs/${p.path}/index.html`, index);
  fullIndex += `<li><h2><a href="/script/${p.path}/index.html">${p.name}</a></h2></li>\n`;
}

fullIndex += `
</ul>
</div>
</body>
</div>
</html>`;

// Write the main index.html file
fs.writeFileSync('./docs/index.html', fullIndex);
// Copy the style.css file
fs.copyFileSync('./style.css', './docs/style.css');

// Write the failed packages file
fs.writeFileSync('./failed.txt', failed.join('\n'));
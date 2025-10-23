import fs from 'fs';
import path from 'path';
import { compareVersions } from './sort_utils.js';
import { fetchNpmPackage, fetchNpmPackageVersion } from './npm_utils.js';
import { generateTypeDoc, generateOnlyStructure } from './docgen.js';
import template from './template.js';

const isNoFail = process.argv.includes('--no-fail');

function createRedirect(tag, tags, pack, availableVersions) {
  if (tags[tag] && availableVersions.indexOf(tags[tag]) !== -1) {
    let redirect = template('redirect.html', {
      path: `/script/${pack.path}/${tags[tag]}/index.html`
    })
    fs.writeFileSync(`./docs/${pack.path}/${tag}.html`, redirect);
    return template('module_link.html', {
      path: `/script/${pack.path}`,
      name: tag
    });
  }
  return '';
}

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
    name: '@minecraft/server-graphics',
    path: 'server-graphics'
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
  },
  {
    name: '@minecraft/server-admin',
    path: 'server-admin'
  },
  {
    name: "@minecraft/common",
    path: "common"
  },
  {
    name: "@bedrock-oss/bedrock-boost",
    path: "bedrock-boost",
    main: "dist/index.d.ts",
    skipStructure: true
  },
  {
    name: "@minecraft/vanilla-data",
    path: "vanilla-data",
    main: "lib/index.d.ts",
    skipStructure: true
  },
  {
    name: "@minecraft/debug-utilities",
    path: "debug-utilities"
  },
  {
    name: "@minecraft/diagnostics",
    path: "diagnostics"
  },
  {
    name: "@minecraft/math",
    path: "math",
    main: "lib/types/math.d.ts"
  }
]

const diffInfo = {};

// A list of failed packages. If a package fails to generate docs, it will be added to this list and never tried again.
let failed = [];
if (fs.existsSync('./failed.txt')) {
  failed = fs.readFileSync('./failed.txt', 'utf-8').split('\n');
}

// Generate the main index.html file
let moduleList = "";

for (const p of packages) {
  if (!p.skipStructure) {
    diffInfo[p.name] = {
      versions: [],
      path: p.path
    }
  }
  let pack = await fetchNpmPackage(p.name);
  for (const version in pack.versions) {
    // Skip deprecated versions
    if (pack.versions[version].deprecated) {
      continue;
    }
    // Skip if it failed before
    if (failed.indexOf(p.path + ' ' + version) !== -1) {
      continue;
    }

    // This is only for regenerating structure.json files
    // if (!p.skipStructure) {
    //   await generateOnlyStructure(p.path, p.name, version, p.main ?? "index.d.ts");
    // }

    // Skip if the docs already exist
    if (fs.existsSync(`./docs/${p.path}/${version}`)) {
      continue;
    }
    // Download the tarball and generate the docs
    await fetchNpmPackageVersion(p.name, version)
      .then(([data, version]) => {
        const url = data.dist.tarball;
        return generateTypeDoc(p.path, p.name, url, version, p.main ?? "index.d.ts", !!p.skipStructure, failed);
      });
  }

  // Generate the index.html file for a package
  let availableVersions = fs.readdirSync('./docs/' + p.path).filter((file) => {
    return fs.statSync(`./docs/${p.path}/${file}`).isDirectory();
  }).sort(compareVersions)
    .reverse();
  if (!p.skipStructure) {
    diffInfo[p.name].versions = availableVersions;
  }

  let dist = pack['dist-tags'] || {};
  let latestLink = createRedirect('latest', dist, p, availableVersions);
  let betaLink = createRedirect('beta', dist, p, availableVersions);
  let rcLink = createRedirect('rc', dist, p, availableVersions);

  let index = template('module_index.html', {
    title: p.name,
    list: availableVersions
      .map((file) => {
        file = path.basename(file);
        return template('version_item.html', {
          name: file,
          path: `/script/${p.path}/${file}/index.html`
        });
      }).join('\n')
  });
  fs.writeFileSync(`./docs/${p.path}/index.html`, index);
  let links = latestLink + betaLink + rcLink;
  moduleList += template('module_item.html', {
    name: p.name,
    path: `/script/${p.path}`,
    links: links
  });
}

// Write the main index.html file
fs.writeFileSync('./docs/index.html', template('index.html', {
  list: moduleList
}));
// Copy the style.css file
fs.copyFileSync('./templates/style.css', './docs/style.css');

// Write the diff.json file
fs.writeFileSync('./docs/diff.json', JSON.stringify(diffInfo));

// Copy diff.html
fs.copyFileSync('./templates/diff.html', './docs/diff.html');

// Write the failed packages file
if (!isNoFail) {
  fs.writeFileSync('./failed.txt', failed.join('\n'));
}
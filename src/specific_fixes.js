import * as fs from 'fs';
import * as path from 'path';

export const PRE_INSTALL = 'PRE_INSTALL';
export const POST_INSTALL = 'POST_INSTALL';

const fixes = [
  {
    name: 'Fixing incorrect argument type for runJob function',
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return moduleName === '@minecraft/server' && (version === '1.9.0-beta.1.20.60-preview.26' || version === '1.9.0-beta.1.20.60-stable')
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, 'index.d.ts');
      let index = fs.readFileSync(indexPath, 'utf-8');
      index = index.replace('runJob(generator: generator): number;', 'runJob(generator: Generator): number;')
      fs.writeFileSync(indexPath, index);
    }
  },
  {
    name: 'Fixing incorrect argument type for runJob function',
    stage: POST_INSTALL,
    canApply: (moduleName, version) => {
      return moduleName === '@minecraft/server-editor' && (version === '0.1.0-beta.1.20.60-preview.26' || version === '0.1.0-beta.1.20.60-stable')
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, 'node_modules', '@minecraft', 'server', 'index.d.ts');
      let index = fs.readFileSync(indexPath, 'utf-8');
      index = index.replace('runJob(generator: generator): number;', 'runJob(generator: Generator): number;')
      fs.writeFileSync(indexPath, index);
    }
  },
  {
    name: 'Removing devDependencies from package.json',
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return moduleName === '@minecraft/math'
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, 'package.json');
      let index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      index.devDependencies = {};
      fs.writeFileSync(indexPath, JSON.stringify(index));
    }
  }
]

export function processVersion(moduleName, version, pkgPath, stage) {
  if (stage === PRE_INSTALL) {
    console.log(`Processing ${moduleName} ${version}`)
  }
  for (const fix of fixes) {
    if (fix.stage === stage && fix.canApply(moduleName, version)) {
      console.log(`Applying fix: ${fix.name}`)
      fix.apply(pkgPath)
    }
  }
}
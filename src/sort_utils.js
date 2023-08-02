// This is a pattern for versions like "1.5.0-beta.1.20.20-preview.23"
// The first part is the semver, the second part is the tag, the third part is the mc semver, the fourth part is the mc build, the fifth part is the mc revision.
const versionPattern = /(\d+\.\d+\.\d+)(?:-([a-z]+)\.(\d+\.\d+\.\d+)-([a-z]+)\.?(\d+)?)?/g;
// This is a pattern for versions like "1.1.0-beta.release.1.19.50"
// The first part is the semver, the second part is the tag, the third part is the mc build, the fourth part is the mc semver, the fifth part is the mc revision.
const oldVersionPattern = /(\d+\.\d+\.\d+)(?:-([a-z]+)(?:\.([a-z]+))?\.(\d+\.\d+\.\d+)\.?(\d+)?)?/g;

function compareSemver(a, b) {
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  const aSplit = a.split('.');
  const bSplit = b.split('.');
  for (let i = 0; i < 3; i++) {
    if (aSplit[i] !== bSplit[i]) {
      return aSplit[i] - bSplit[i];
    }
  }
  return 0;
}

function compareTag(a, b) {
  // Possible tags: beta, rc, release
  if (a === 'release') {
    return 1;
  }
  if (b === 'release') {
    return -1;
  }
  if (a === 'rc') {
    return 1;
  }
  if (b === 'rc') {
    return -1;
  }
  if (a === 'beta') {
    return 1;
  }
  if (b === 'beta') {
    return -1;
  }
  return 0;
}

function compareBuild(a, b) {
  // Possible builds: preview, stable
  if (a === 'stable') {
    return 1;
  }
  if (b === 'stable') {
    return -1;
  }
  if (a === 'preview') {
    return 1;
  }
  if (b === 'preview') {
    return -1;
  }
  return 0;
}

// Parses version string into [semver, tag, mc semver, mc build, mc revision]
// In case parsing fails, returns [version, null, null, null, -1] (revision as -1 to sort it last)
// Helps with sorting
function parseVersion(version) {
  versionPattern.lastIndex = 0;
  const aGroups = versionPattern.exec(version);
  if (versionPattern.lastIndex === version.length) {
    const aSemver = aGroups[1];
    const aTag = aGroups[2] ?? 'release';
    const aMcSemver = aGroups[3];
    const aMcBuild = aGroups[5];
    const aMcRevision = aGroups[4];
    return [aSemver, aTag, aMcSemver, aMcBuild, aMcRevision];
  } else {
    oldVersionPattern.lastIndex = 0;
    const aGroups = oldVersionPattern.exec(version);
    if (oldVersionPattern.lastIndex !== version.length) {
      return [version, null, null, null, -1];
    }
    const aSemver = aGroups[1];
    const aTag = aGroups[3] === void 0 ? 'release' : aGroups[2];
    const aMcSemver = aGroups[4];
    const aMcBuild = aGroups[3] === 'release' ? 'stable' : aGroups[3];
    const aMcRevision = aGroups[5];
    return [aSemver, aTag, aMcSemver, aMcBuild, aMcRevision];
  }
}

function compareVersions(a, b) {
  const [aSemver, aTag, aMcSemver, aMcBuild, aMcRevision] = parseVersion(a);

  const [bSemver, bTag, bMcSemver, bMcBuild, bMcRevision] = parseVersion(b);

  // If the version is invalid, sort it last.
  if (aMcRevision === -1) {
    if (bMcRevision === -1) {
      return 0;
    }
    return -1;
  } else if (bMcRevision === -1) {
    return 1;
  }

  if (aSemver !== bSemver) {
    return compareSemver(aSemver, bSemver);
  }
  if (aTag !== bTag) {
    return compareTag(aTag, bTag);
  }

  if (aMcSemver !== bMcSemver) {
    return compareSemver(aMcSemver, bMcSemver);
  }

  if (aMcBuild !== bMcBuild) {
    return compareBuild(aMcBuild, bMcBuild);
  }

  return aMcRevision - bMcRevision;
}

export { compareVersions };
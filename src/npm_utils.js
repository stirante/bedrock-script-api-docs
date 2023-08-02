import fetch from "node-fetch";

// Fetches the package description from npm.
function fetchNpmPackage(packageName) {
  return fetch(`https://registry.npmjs.org/${packageName}`)
    .then((response) => response.json())
    .then((data) => data);
}

// Fetches the package version description from npm.
function fetchNpmPackageVersion(packageName, version) {
  return fetch(`https://registry.npmjs.org/${packageName}/${version}`)
    .then((response) => response.json())
    .then((data) => [data, version]);
}

export { fetchNpmPackage, fetchNpmPackageVersion };
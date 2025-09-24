import * as fs from "fs";
import * as path from "path";

export const PRE_INSTALL = "PRE_INSTALL";
export const POST_INSTALL = "POST_INSTALL";

const fixes = [
  {
    name: "Fixing incorrect argument type for runJob function",
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server" &&
        (version === "1.9.0-beta.1.20.60-preview.26" ||
          version === "1.9.0-beta.1.20.60-stable")
      );
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, "index.d.ts");
      let index = fs.readFileSync(indexPath, "utf-8");
      index = index.replace(
        "runJob(generator: generator): number;",
        "runJob(generator: Generator): number;"
      );
      fs.writeFileSync(indexPath, index);
    },
  },
  {
    name: "Fixing incorrect argument type for runJob function",
    stage: POST_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server-editor" &&
        (version === "0.1.0-beta.1.20.60-preview.26" ||
          version === "0.1.0-beta.1.20.60-stable")
      );
    },
    apply: (pkgPath) => {
      const indexPath = path.join(
        pkgPath,
        "node_modules",
        "@minecraft",
        "server",
        "index.d.ts"
      );
      let index = fs.readFileSync(indexPath, "utf-8");
      index = index.replace(
        "runJob(generator: generator): number;",
        "runJob(generator: Generator): number;"
      );
      fs.writeFileSync(indexPath, index);
    },
  },
  {
    name: "Removing devDependencies from package.json",
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return moduleName === "@minecraft/math";
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, "package.json");
      let index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      index.devDependencies = {};
      fs.writeFileSync(indexPath, JSON.stringify(index));
    },
  },
  {
    name: "Fixing missing typedef for variant type in server-editor",
    stage: POST_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server-editor" &&
        (version === "0.1.0-beta.1.21.0-preview.21" ||
          version === "0.1.0-beta.1.21.0-preview.20")
      );
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, "index.d.ts");
      let index = fs.readFileSync(indexPath, "utf-8");
      index = index.replace(
        "onChange: (arg: variant) => boolean",
        "onChange: (arg: boolean | number | string | minecraftserver.Vector3) => boolean"
      );
      // Not sure why the second one is not getting replaced, but repeating the replace fixes it
      index = index.replace(
        "onChange: (arg: variant) => boolean",
        "onChange: (arg: boolean | number | string | minecraftserver.Vector3) => boolean"
      );
      index = index.replace(
        "valueChanged?: (arg: variant) => void",
        "valueChanged?: (arg: boolean | number | string | minecraftserver.Vector3) => void"
      );
      index = index.replace(
        "valueChanged?: (arg: variant) => void",
        "valueChanged?: (arg: boolean | number | string | minecraftserver.Vector3) => void"
      );
      fs.writeFileSync(indexPath, index);
    },
  },
  {
    name: "Fixing missing WidgetCreateOptions interface in server-editor",
    stage: POST_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server-editor" &&
        version === "0.1.0-beta.1.21.30-preview.21"
      );
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, "index.d.ts");
      let index = fs.readFileSync(indexPath, "utf-8");
      const position = index.indexOf(
        "export interface WidgetGroupCreateOptions"
      );
      const content = `export interface WidgetCreateOptions {
    collisionOffset?: minecraftserver.Vector3;
    collisionRadius?: number;
    selectable?: boolean;
    snapToBlockLocation?: boolean;
    stateChangeEvent?: (arg: WidgetStateChangeEventData) => void;
    visible?: boolean;
}

`;
      index = index.slice(0, position) + content + index.slice(position);
      fs.writeFileSync(indexPath, index);
    },
  },
  {
    name: "Fixing wrong package name in server-gametest",
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server-gametest" &&
        [
          "0.1.0-rc.1.21.30-preview.23",
          "0.1.0-rc.1.21.30-preview.24",
          "0.1.0-rc.1.21.30-preview.25",
          "0.1.0-rc.1.21.40-preview.20",
          "0.1.0",
        ].includes(version)
      );
    },
    apply: (pkgPath) => {
      const packagePath = path.join(pkgPath, "package.json");
      let pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      pkg.dependencies["@minecraft/server"] = "1.13.0";
      delete pkg.dependencies["mojang-minecraft"];
      fs.writeFileSync(packagePath, JSON.stringify(pkg));
      const indexPath = path.join(pkgPath, "index.d.ts");
      let index = fs.readFileSync(indexPath, "utf-8");
      index = index.replace(
        "from 'mojang-minecraft'",
        "from '@minecraft/server'"
      );
      fs.writeFileSync(indexPath, index);
    },
  },
  {
    name: "Fixing missing vanilla-data",
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return [
        "1.0.0-beta.1.21.70-preview.20",
        "0.1.0-beta.1.21.70-preview.20",
        "2.0.0-beta.1.21.70-preview.20",
      ].includes(version);
    },
    apply: (pkgPath) => {
      const packagePath = path.join(pkgPath, "package.json");
      let pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      if (pkg.peerDependencies === undefined) {
        pkg.overrides = {
          "@minecraft/vanilla-data": "1.21.70-preview.20",
        };
      } else {
        pkg.peerDependencies["@minecraft/vanilla-data"] = "1.21.70-preview.20";
      }
      fs.writeFileSync(packagePath, JSON.stringify(pkg));
    },
  },
  {
    name: "Fixing incorrect vanilla-data version",
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server" &&
        [
          "2.3.0-beta.1.21.110-preview.23",
          "2.3.0-beta.1.21.110-preview.24",
          "2.3.0-beta.1.21.110-preview.25",
          "2.3.0-beta.1.21.110-preview.26",
          "2.4.0-beta.1.21.120-preview.20",
          "2.4.0-beta.1.21.120-preview.21",
          "2.4.0-beta.1.21.120-preview.22",
          "2.4.0-beta.1.21.120-preview.23",
        ].includes(version)
      );
    },
    apply: (pkgPath) => {
      const packagePath = path.join(pkgPath, "package.json");
      let pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      pkg.peerDependencies["@minecraft/vanilla-data"] =
        pkg.peerDependencies["@minecraft/vanilla-data"].split(" || ")[1];
      fs.writeFileSync(packagePath, JSON.stringify(pkg));
    },
  },
  {
    name: "Fixing incorrect vanilla-data version",
    stage: PRE_INSTALL,
    canApply: (moduleName, version) => {
      return (
        moduleName === "@minecraft/server-editor" &&
        [
          "0.1.0-beta.1.21.110-preview.23",
          "0.1.0-beta.1.21.110-preview.24",
          "0.1.0-beta.1.21.110-preview.25",
          "0.1.0-beta.1.21.110-preview.26",
          "0.1.0-beta.1.21.120-preview.20",
          "0.1.0-beta.1.21.120-preview.21",
          "0.1.0-beta.1.21.120-preview.22",
          "0.1.0-beta.1.21.120-preview.23",
        ].includes(version)
      );
    },
    apply: (pkgPath) => {
      const packagePath = path.join(pkgPath, "package.json");
      let pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
      pkg.overrides = {
        "@minecraft/vanilla-data": "1.21.110-preview.25",
      };
      pkg.peerDependencies = {
        ...(pkg.peerDependencies ?? {}),
        "@minecraft/vanilla-data": "1.21.110-preview.25",
      };
      fs.writeFileSync(packagePath, JSON.stringify(pkg));
    },
  },
  {
    name: "Fixing incorrect minecraft/server alias",
    stage: POST_INSTALL,
    canApply: (moduleName, version) => {
      return (
        (moduleName === "@minecraft/server-editor" &&
          ["0.1.0-beta.1.21.120-preview.20"].includes(version)) ||
        (moduleName === "@minecraft/server-ui" &&
          ["2.1.0-beta.1.21.120-preview.20"].includes(version)) ||
        ((moduleName === "@minecraft/server-gametest" || moduleName === "@minecraft/server-net" || moduleName === "@minecraft/server-admin" || moduleName === "@minecraft/debug-utilities") &&
          ["1.0.0-beta.1.21.120-preview.20"].includes(version))
      );
    },
    apply: (pkgPath) => {
      const indexPath = path.join(pkgPath, "index.d.ts");
      const index = fs.readFileSync(indexPath, "utf-8");
      const fixed = index.replaceAll(
        "minecraftserverbindings.",
        "minecraftserver."
      );
      fs.writeFileSync(indexPath, fixed);
    },
  },
];

export function processVersion(moduleName, version, pkgPath, stage) {
  if (stage === PRE_INSTALL) {
    console.log(`Processing ${moduleName} ${version}`);
  }
  for (const fix of fixes) {
    if (fix.stage === stage && fix.canApply(moduleName, version)) {
      console.log(`Applying fix: ${fix.name}`);
      fix.apply(pkgPath);
    }
  }
}

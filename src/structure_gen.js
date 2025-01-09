import { parseModule } from "magicast";
import * as babelParser from '@babel/parser';
import fs from 'fs';
import { fetchNpmPackageVersion } from "./npm_utils.js";
import fetch from 'node-fetch';
import { createGunzip } from 'zlib';
import { t } from 'tar';
import path from 'path';
import { debug } from "console";

export class ElementType {
  static ENUM = "enum";
  static CLASS = "class";
  static INTERFACE = "interface";
  static METHOD = "method";
  static PROPERTY = "property";
  static PARAMETER = "parameter";
  static TYPE_ALIAS = "type_alias";
}

let _babelParser;
function getBabelParser() {
  if (_babelParser) {
    return _babelParser;
  }
  const babelOptions = _getBabelOptions();
  _babelParser = {
    parse(source, options) {
      return babelParser.parse(source, {
        ...babelOptions,
        ...options
      });
    }
  };
  return _babelParser;
}
function _getBabelOptions() {
  return {
    sourceType: "module",
    strictMode: false,
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    startLine: 1,
    tokens: true,
    plugins: [
      "asyncGenerators",
      "bigInt",
      "classPrivateMethods",
      "classPrivateProperties",
      "classProperties",
      "classStaticBlock",
      "decimal",
      "decorators-legacy",
      "doExpressions",
      "dynamicImport",
      "exportDefaultFrom",
      "exportExtensions",
      "exportNamespaceFrom",
      "functionBind",
      "functionSent",
      "importAssertions",
      "importMeta",
      "nullishCoalescingOperator",
      "numericSeparator",
      "objectRestSpread",
      "optionalCatchBinding",
      "optionalChaining",
      [
        "pipelineOperator",
        {
          proposal: "minimal"
        }
      ],
      [
        "recordAndTuple",
        {
          syntaxType: "hash"
        }
      ],
      "throwExpressions",
      "topLevelAwait",
      "v8intrinsic",
      "jsx",
      // "typescript",
      ["typescript", { dts: true }]
    ]
  };
}

export function generateStructure(code) {
  const structure = parseModule(code, {
    parser: getBabelParser()
  });

  let elements = [];

  structure.$ast.body.forEach(element => {
    if (element.type === 'ImportDeclaration' || !element.declaration) {
      return;
    }
    elements.push(parse(element.declaration));
  });
  return elements;
}

function parseEnum(element) {
  return {
    type: ElementType.ENUM,
    name: element.id.name,
    values: element.members.map(member => member.id.name)
  };
}

function parseClass(element) {
  return {
    type: ElementType.CLASS,
    name: element.id.name,
    superClass: element.superClass ? element.superClass.name : undefined,
    properties: element.body.body.map(member => parse(member))
  };
}

function parseInterface(element) {
  return {
    type: ElementType.INTERFACE,
    name: element.id.name,
    extends: element.extends && element.extends.length > 0 ? element.extends.map(ext => parseExtendsElement(ext)) : undefined,
    properties: element.body.body.map(member => parse(member))
  };
}

function parseMethod(element) {
  if (element.key.type === 'MemberExpression') {
    element.key.name = "[" + element.key.object.name + "." + element.key.property.name + "]";
  }
  if (!element.key.name) {
    debugger;
  }
  return {
    type: ElementType.METHOD,
    name: element.key.name,
    parameters: (element.params ?? element.parameters).map(param => parseParameter(param)),
    result: parseType(element.returnType ?? element)
  };
}

function parseFunction(element) {
  if (!element.id.name) {
    debugger;
  }
  return {
    type: ElementType.METHOD,
    name: element.id.name,
    parameters: element.params.map(param => parseParameter(param)),
  };
}

function parseProperty(element) {
  return {
    type: ElementType.PROPERTY,
    name: element.key.name ?? "'" + element.key.value + "'",
    propertyType: parseType(element)
  };
}

function parseTypeAlias(element) {
  return {
    type: ElementType.TYPE_ALIAS,
    name: element.id.name,
    propertyType: parseType(element)
  };
}

function parseVariable(element) {
  return {
    type: ElementType.PROPERTY,
    name: element.name,
    propertyType: parseType(element)
  };
}

function parseParameter(element) {
  return {
    type: ElementType.PARAMETER,
    name: element.name,
    parameterType: parseType(element)
  };
}

function parseType(element) {
  //TODO: Handle type parameters
  if (!element) {
    return "void";
  }
  if (!element.typeAnnotation) {
    if (!element.value) {
      return "void";
    }
    if (element.value.type === 'StringLiteral') {
      return "string";
    } else if (element.value.type === 'UnaryExpression') {
      return parseType({ value: element.value.argument });
    } else if (element.value.type === 'NumericLiteral') {
      return "number";
    } else if (element.value.type === 'TemplateLiteral') {
      let str = "";
      for (let i = 0; i < element.value.quasis.length; i++) {
        str += element.value.quasis[i].value.raw;
        if (i < element.value.expressions.length) {
          str += '${' + parseType({ value: element.value.expressions[i] }) + '}';
        }
      }
      return "`" + str + "`";
    } else if (element.value.type === 'TSTypeReference') {
      if (element.value.typeName.type === 'TSQualifiedName') {
        return element.value.typeName.left.name + "." + element.value.typeName.right.name;
      }
      return element.value.typeName.name ?? '';
    }
    throw new Error("Unknown literal type: " + element.value.type + " at " + element.loc.start.line + ":" + element.loc.start.column);
  }
  if (element.typeAnnotation.type === 'TSStringKeyword') {
    return "string"
  } else if (element.typeAnnotation.type === 'TSTypeReference') {
    let params = "";
    if (element.typeAnnotation.typeParameters) {
      params = "<" + element.typeAnnotation.typeParameters.params.map(param => parseType({ typeAnnotation: param })).join(", ") + ">";
    }
    if (element.typeAnnotation.typeName.type === 'TSQualifiedName') {
      return (element.typeAnnotation.typeName.left.name + "." + element.typeAnnotation.typeName.right.name) + params;
    }
    return (element.typeAnnotation.typeName.name ?? '') + params;
  } else if (element.typeAnnotation.type === 'TSArrayType') {
    return parseType({ typeAnnotation: element.typeAnnotation.elementType }) + "[]";
  } else if (element.typeAnnotation.type === 'TSUnionType') {
    return element.typeAnnotation.types.map(type => parseType({ typeAnnotation: type })).join(" | ");
  } else if (element.typeAnnotation.type === 'TSFunctionType') {
    return "(" + element.typeAnnotation.parameters.map(param => param.name + ": " + parseType(param)).join(", ") + ") => " + parseType(element.typeAnnotation.typeAnnotation);
  } else if (element.typeAnnotation.type === 'TSVoidKeyword') {
    return "void";
  } else if (element.typeAnnotation.type === 'TSNumberKeyword') {
    return "number";
  } else if (element.typeAnnotation.type === 'TSBooleanKeyword') {
    return "boolean";
  } else if (element.typeAnnotation.type === 'TSNullKeyword') {
    return "null";
  } else if (element.typeAnnotation.type === 'TSTypeAnnotation') {
    return parseType(element.typeAnnotation);
  } else if (element.typeAnnotation.type === 'TSParenthesizedType') {
    return "(" + parseType(element.typeAnnotation) + ")";
  } else if (element.typeAnnotation.type === 'TSAnyKeyword') {
    return "any";
  } else if (element.typeAnnotation.type === 'TSLiteralType') {
    return parseType({ value: element.typeAnnotation.literal });
  } else if (element.typeAnnotation.type === 'TSTypeLiteral') {
    return "{ " + element.typeAnnotation.members.map(member => (member.key.value ? ("'" + member.key.value + "'") : member.key.name) + ": " + parseType(member)).join(", ") + " }";
  } else if (element.typeAnnotation.type === 'TSIntersectionType') {
    return element.typeAnnotation.types.map(type => parseType({ typeAnnotation: type })).join(" & ");
  } else if (element.typeAnnotation.type === 'TSUndefinedKeyword') {
    return "undefined";
  } else if (element.typeAnnotation.type === 'TSNeverKeyword') {
    return "never";
  } else if (element.typeAnnotation.type === 'TSThisType') {
    return "this";
  } else if (element.typeAnnotation.type === 'TSUnknownKeyword') {
    return "unknown";
  } else if (element.typeAnnotation.type === 'TSObjectKeyword') {
    return "object";
  } else if (element.typeAnnotation.type === 'TSIndexedAccessType') {
    return parseType({ typeAnnotation: element.typeAnnotation.objectType }) + "[" + parseType({ typeAnnotation: element.typeAnnotation.indexType }) + "]";
  } else if (element.typeAnnotation.type === 'TSConditionalType') {
    return parseType({ typeAnnotation: element.typeAnnotation.checkType }) + " extends " + parseType({ typeAnnotation: element.typeAnnotation.extendsType }) + " ? " + parseType({ typeAnnotation: element.typeAnnotation.trueType }) + " : " + parseType({ typeAnnotation: element.typeAnnotation.falseType });
  } else if (element.typeAnnotation.type === 'TSTypeOperator') {
    return element.typeAnnotation.operator + " " + parseType({ typeAnnotation: element.typeAnnotation.typeAnnotation });
  } else if (element.typeAnnotation.type === 'TSTypeQuery') {
    return "typeof " + parseType({ typeAnnotation: element.typeAnnotation.exprName });
  } else if (element.typeAnnotation.type === 'TSQualifiedName') {
    return element.typeAnnotation.left.name + "." + element.typeAnnotation.right.name;
  }
  throw new Error("Unknown type annotation: " + element.typeAnnotation.type + " at " + element.loc.start.line + ":" + element.loc.start.column);
}

function parseExtendsElement(element) {
  if (element.type === 'TSExpressionWithTypeArguments') {
    return element.expression.name;
  } else if (element.type === 'TSQualifiedName') {
    return element.left.name + "." + element.right.name;
  }
  throw new Error("Unknown extends element type: " + element.type + " at " + element.loc.start.line + ":" + element.loc.start.column);
}

function parse(element) {
  if (element.type === 'TSEnumDeclaration') {
    return parseEnum(element);
  } else if (element.type === 'ClassDeclaration') {
    return parseClass(element);
  } else if (element.type === 'ExportNamedDeclaration') {
    return parse(element.declaration);
  } else if (element.type === 'TSDeclareMethod' || element.type === 'TSMethodSignature') {
    return parseMethod(element);
  } else if (element.type === 'ClassProperty') {
    return parseProperty(element);
  } else if (element.type === 'TSInterfaceDeclaration') {
    return parseInterface(element);
  } else if (element.type === 'TSPropertySignature') {
    return parseProperty(element);
  } else if (element.type === 'VariableDeclaration') {
    return element.declarations.map(declaration => parseVariable(declaration.id));
  } else if (element.type === 'TSDeclareFunction') {
    return parseFunction(element);
  } else if (element.type === 'TSTypeAliasDeclaration') {
    return parseTypeAlias(element);
  }

  else {
    let loc = element.loc;
    if (!loc && element.body) {
      loc = element.body.loc;
    }
    if (!loc && element.declarations && element.declarations.length > 0) {
      loc = element.declarations[0].loc;
    }
    if (!loc && element.id) {
      loc = element.id.loc;
    }
    throw new Error("Unknown element type: " + element.type + " at " + loc.start.line + ":" + loc.start.column);
  }
}

async function downloadForTesting(tag) {
  const fileName = tag + '.ts';
  if (fs.existsSync(fileName)) {
    return fileName;
  }
  const ver = await fetchNpmPackageVersion('@minecraft/server', tag);
  const url = ver[0].dist.tarball;
  const response = await fetch(url);
  await new Promise((resolve, reject) => {
    response.body
      .pipe(createGunzip())
      .pipe(t())
      .on('entry', (entry) => {
        if (path.basename(entry.path) === 'index.d.ts') {
            entry.pipe(fs.createWriteStream(fileName));
        } else {
            entry.resume();
        }
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        resolve(fileName);
        console.log(`Finished extracting`);
      });
  });
}

// async function test(version) {
//   const fileName = await downloadForTesting(version);
//   const code = fs.readFileSync(fileName, 'utf8');
//   const elements = generateStructure(code);
//   fs.writeFileSync("docs/server/" + version + "/structure.json", JSON.stringify(elements, null, 2));
//   return elements;
// }

// await test('1.14.0-beta.1.21.20-preview.21');

// const code = fs.readFileSync('./tmp/package/index.d.ts', 'utf8');
// const elements = generateStructure(code);
// fs.writeFileSync("./structure.json", JSON.stringify(elements, null, 2));
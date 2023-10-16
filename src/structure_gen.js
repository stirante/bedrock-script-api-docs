import { parseModule } from "magicast";
import * as babelParser from '@babel/parser';
import fs from 'fs';

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
    if (element.type === 'ImportDeclaration') {
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
    properties: element.body.body.map(member => parse(member))
  };
}

function parseInterface(element) {
  if (element.id.name === 'ActionManager') {
    debugger;
  }
  return {
    type: ElementType.INTERFACE,
    name: element.id.name,
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
    }
    throw new Error("Unknown literal type: " + element.value.type + " at " + element.loc.start.line + ":" + element.loc.start.column);
  }
  if (element.typeAnnotation.type === 'TSStringKeyword') {
    return "string"
  } else if (element.typeAnnotation.type === 'TSTypeReference') {
    return element.typeAnnotation.typeName.name ?? '';
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
    return "{ " + element.typeAnnotation.members.map(member => member.key.name + ": " + parseType(member)).join(", ") + " }";
  } else if (element.typeAnnotation.type === 'TSIntersectionType') {
    return element.typeAnnotation.types.map(type => parseType({ typeAnnotation: type })).join(" & ");
  } else if (element.typeAnnotation.type === 'TSUndefinedKeyword') {
    return "undefined";
  } else if (element.typeAnnotation.type === 'TSObjectKeyword') {
    return "object";
  } else if (element.typeAnnotation.type === 'TSIndexedAccessType') {
    return parseType({ typeAnnotation: element.typeAnnotation.objectType }) + "[" + parseType({ typeAnnotation: element.typeAnnotation.indexType }) + "]";
  }
  throw new Error("Unknown type annotation: " + element.typeAnnotation.type + " at " + element.loc.start.line + ":" + element.loc.start.column);
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
function test(filename) {
  const code = fs.readFileSync(filename, 'utf8');
  const elements = generateStructure(code);
  fs.writeFileSync("test.json", JSON.stringify(elements, null, 2));
  return elements;
}

// test("./tmp/package/index.d.ts");
// let b = test("1.7.0-beta.ts");
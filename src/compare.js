import { diffArrays } from "diff";

function getAddedString(value) {
  return `+ ${value}`;
}

function getRemovedString(value) {
  return `- ${value}`;
}

function getChangedString(oldValue, newValue) {
  return `! ${oldValue} -> ${newValue}`;
}

export class ElementType {
  static ENUM = "enum";
  static CLASS = "class";
  static INTERFACE = "interface";
  static METHOD = "method";
  static PROPERTY = "property";
  static PARAMETER = "parameter";
  static TYPE_ALIAS = "type_alias";
}

function linkParents(element) {
  ['properties', 'parameters'].forEach(key => {
    if (element[key]) {
      element[key].forEach(child => {
        child.parent = element;
        linkParents(child);
      });
    }
  });
}

function buildMap(elements) {
  const map = {};
  elements.forEach(element => {
    linkParents(element);
    map[element.name] = element;
  });
  return map;
}

export function compareStructures(a, b) {
  const aMap = buildMap(a);
  const bMap = buildMap(b);
  const aKeys = Object.keys(aMap).sort();
  const bKeys = Object.keys(bMap).sort();
  let changed = [];

  aKeys.forEach(name => compareElements(aMap[name], bMap[name], changed));
  bKeys.forEach(name => compareElements(aMap[name], bMap[name], changed));

  return changed;
}

function toString(element) {
  switch (element.type) {
    case ElementType.ENUM:
      return `enum ${element.name}`;
    case ElementType.CLASS:
    case ElementType.INTERFACE:
      return `${element.type} ${element.name}`;
    case ElementType.METHOD:
      return `${element.parent ? element.parent.name + '.' : ''}${element.name}(${element.parameters.map(param => `${param.name}: ${param.parameterType}`).join(', ')}): ${element.result}`;
    case ElementType.PROPERTY:
      return `${element.parent ? element.parent.name + '.' : ''}${element.name}: ${element.propertyType}`;
    case ElementType.TYPE_ALIAS:
      return `type ${element.name} = ${element.propertyType}`;
    default:
      throw new Error(`Unknown element type: ${element.type}`);
  }
}

function processChanges(changes, aName, bName, changed) {
  let i = 0;
  while (i < changes.length) {
    const part = changes[i];
    if (part.added) {
      if (i > 0 && changes[i - 1].removed) {
        for (let j = 0; j < part.count; j++) {
          changed.push(getChangedString(`${aName}.${changes[i - 1].value[j]}`, `${bName}.${part.value[j]}`));
        }
        i++; // skip next part as it's already processed
      } else {
        changed.push(...part.value.map(value => getAddedString(`${bName}.${value}`)));
      }
    } else if (part.removed) {
      if (i < changes.length - 1 && changes[i + 1].added) {
        // do nothing as this part will be handled in the next iteration
      } else {
        changed.push(...part.value.map(value => getRemovedString(`${aName}.${value}`)));
      }
    }
    i++;
  }
}

/**
 * Compares two elements and adds the result to the changed array.
 */
function compareElements(a = {}, b = {}, changed) {
  if (a.type !== b.type && a.type && b.type) {
    changed.push(getChangedString(`${a.name} type: ${a.type}`, b.type));
  }
  const count = changed.length;

  if (a.type === ElementType.ENUM) {
    const aValues = a.values || [];
    const bValues = b.values || [];
    const changes = diffArrays(aValues.sort(), bValues.sort(), { comparator: (a, b) => a === b });
    processChanges(changes, a.name, b.name, changed);
  } else if ([ElementType.CLASS, ElementType.INTERFACE].includes(b.type)) {
    compareProperties(a.properties || [], b.properties || [], changed);
  } else if (b.type === ElementType.METHOD || b.type === ElementType.PROPERTY || b.type === ElementType.TYPE_ALIAS) {
    compareLeaves(a, b, changed);
  }

  if ([ElementType.CLASS, ElementType.INTERFACE, ElementType.ENUM].includes(b.type) && changed.length > count) {
    changed.push("");
  }
}

/**
 * Compares two elements, that can have child elements and adds the result to the changed array.
 */
function compareProperties(aProperties = [], bProperties = [], changed) {
  const aMap = buildMap(aProperties);
  const bMap = buildMap(bProperties);

  aProperties.forEach(property => compareElements(aMap[property.name], bMap[property.name], changed));
  bProperties.forEach(property => compareElements(aMap[property.name], bMap[property.name], changed));
}

/**
 * Compares two elements, that don't have any child elements and adds the result to the changed array.
 */
function compareLeaves(a, b, changed) {
  if (a.type && b.type && toString(a) !== toString(b)) {
    changed.push(getChangedString(toString(a), toString(b)));
  } else if (!a.type) {
    changed.push(getAddedString(toString(b)));
  } else if (!b.type) {
    changed.push(getRemovedString(toString(a)));
  }
}
import { diffArrays } from "diff";

export class ElementType {
  static ENUM = "enum";
  static CLASS = "class";
  static INTERFACE = "interface";
  static METHOD = "method";
  static PROPERTY = "property";
  static PARAMETER = "parameter";
  static TYPE_ALIAS = "type_alias";
}

export class ChangeType {
  static REMOVED = 0;
  static CHANGED = 1;
  static ADDED = 2;
}

export class Change {
  constructor(type, changeDetail, groupName, oldValue, newValue) {
    this.type = type;
    this.changeDetail = changeDetail;
    this.groupName = groupName;
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
  static added(groupName, newValue, changeDetail = '') {
    return new Change(ChangeType.ADDED, changeDetail, groupName, null, newValue);
  }
  static removed(groupName, oldValue, changeDetail = '') {
    return new Change(ChangeType.REMOVED, changeDetail, groupName, oldValue, null);
  }
  static changed(groupName, oldValue, newValue, changeDetail = '') {
    return new Change(ChangeType.CHANGED, changeDetail, groupName, oldValue, newValue);
  }
  toString() {
    switch (this.type) {
      case ChangeType.ADDED:
        return '<div class="change"><div class="chip chip-added">ADDED</div> ' + this.changeDetail + this.newValue + '</div>';
      case ChangeType.REMOVED:
        return '<div class="change"><div class="chip chip-removed">REMOVED</div> ' + this.changeDetail + this.oldValue + '</div>';
      case ChangeType.CHANGED:
        return '<div class="change"><div class="chip chip-changed">CHANGED</div> ' + this.changeDetail + this.oldValue + ' -> ' +  this.newValue + '</div>';
      default:
        throw new Error(`Unknown change type: ${this.type}`);
    }
  }
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
          changed.push(Change.changed(aName, `${aName}.${changes[i - 1].value[j]}`, `${bName}.${part.value[j]}`));
        }
        i++; // skip next part as it's already processed
      } else {
        changed.push(...part.value.map(value => Change.added(bName, `${bName}.${value}`)));
      }
    } else if (part.removed) {
      if (i < changes.length - 1 && changes[i + 1].added) {
        // do nothing as this part will be handled in the next iteration
      } else {
        changed.push(...part.value.map(value => Change.removed(aName, `${aName}.${value}`)));
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
    changed.push(Change.changed(a.name, `${a.type}`, `${b.type}`, `${b.name} type: `));
  }

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
    changed.push(Change.changed(b.parent?.name, toString(a), toString(b)));
  } else if (!a.type) {
    changed.push(Change.added(b.parent?.name, toString(b)));
  } else if (!b.type) {
    changed.push(Change.removed(a.parent?.name, toString(a)));
  }
}
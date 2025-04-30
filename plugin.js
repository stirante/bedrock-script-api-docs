import { Converter } from "typedoc";
import { DefaultTheme } from "typedoc";

const Filters = {
  '@worldMutation': {
    "match": ["This function can't be called in read-only mode.", "This property can't be edited in read-only mode."],
    "invert": false
  },
  '@notEarlyExecution': {
    "match": ["This function can be called in early-execution mode.", "This property can be edited in early-execution mode."],
    "invert": true
  },
}

function toKebabCase(str) {
  return str.substring(1).replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export function load(app) {
  // Somehow I can't modify the reflection and comments are empty in getReflectionClasses, so I need to remember the IDs
  // But somehow the IDs are offset by 1, so I need to add 1 to the ID of the reflection
  const ids = {};
  const original = DefaultTheme.prototype.getReflectionClasses;
  DefaultTheme.prototype.getReflectionClasses = function (reflection) {
    let classes = original.call(this, reflection);
    let newClasses = [];
    for (const filter of Object.keys(Filters)) {
      if (ids[filter] && ids[filter].includes(reflection.id + 1)) {
        newClasses.push("tsd-is-" + toKebabCase(filter));
      }
    }
    return (
      classes + ((classes.length !== 0 ? " " : "") + newClasses.join(" ")).trim()
    );
  };
  app.converter.on(Converter.EVENT_RESOLVE, (context, reflection) => {
    if (reflection.comment) {
      for (const filter of Object.keys(Filters)) {
        if (commentContainsPhrase(reflection.comment, Filters[filter].match) === !Filters[filter].invert) {
          if (!ids[filter]) {
            ids[filter] = [];
          }
          ids[filter].push(reflection.id);
        }
      }
    }
  });
  // Adding @worldMutation to the visibility filters will add it as a filter
  for (const filter of Object.keys(Filters)) {
    app.options.getValue("visibilityFilters")[filter] = true;
  }
}

function commentContainsPhrase(comment, phrases) {
  return (
    comment?.blockTags?.some((tag) =>
      tag.content.some((content) => phrases.some(x => content.text.includes(x)))
    ) ?? false
  );
}

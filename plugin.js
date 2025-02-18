import { Converter } from "typedoc";
import { DefaultTheme } from "typedoc";

export function load(app) {
  // Somehow I can't modify the reflection and comments are empty in getReflectionClasses, so I need to remember the IDs
  // But somehow the IDs are offset by 1, so I need to add 1 to the ID of the reflection
  const worldMutationIDs = [];
  const original = DefaultTheme.prototype.getReflectionClasses;
  DefaultTheme.prototype.getReflectionClasses = function (reflection) {
    let classes = original.call(this, reflection);
    if (
      worldMutationIDs.includes(reflection.id + 1)
    ) {
      return (
        classes + ((classes.length !== 0 ? " " : "") + "tsd-is-world-mutation")
      );
    }
    return classes;
  };
  app.converter.on(Converter.EVENT_RESOLVE, (context, reflection) => {
    if (
      reflection.comment &&
      commentContainsPhrase(
        reflection.comment,
        "This function can't be called in read-only mode."
      )
    ) {
      worldMutationIDs.push(reflection.id);
    }
  });
  // Adding @worldMutation to the visibility filters will add it as a filter
  app.options.getValue("visibilityFilters")["@worldMutation"] = true;
}

function commentContainsPhrase(comment, phrase) {
  return (
    comment?.blockTags?.some((tag) =>
      tag.content.some((content) => content.text.includes(phrase))
    ) ?? false
  );
}

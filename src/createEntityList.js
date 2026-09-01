import { convertFunctionToConstructor } from "jabr";
import { Signal, isSignal, isStore } from "jabr";

function deepFlat(entityListOrEntity) {
  const outputSignal = Signal([]);

  const flatten = (value) => {
    if (isSignal(value)) {
      const currentValue = value.get();
      if (Array.isArray(currentValue)) {
        return currentValue.flatMap((item) => flatten(item));
      }
      return flatten(currentValue);
    } else if (isStore(value)) {
      const result = [value];
      if (isSignal(value.children)) {
        result.push(...flatten(value.children));
      }
      return result;
    }
    return [];
  };

  const updateOutput = () => {
    outputSignal.set(flatten(entityListOrEntity));
  };

  // Listen to the main entity list
  if (isSignal(entityListOrEntity)) {
    entityListOrEntity.addListener(updateOutput);
  }

  // Initial update
  updateOutput();

  return outputSignal;
}

function createEntityList(initialList = []) {
  const output = new Signal(initialList /*, InnerEntityListFormat*/);

  let flattened = null;

  const methods = {
    addChild: (child) => {
      const currentContent = output.get();
      if (currentContent.includes(child)) {
      } else {
        output.set(currentContent.concat([child]));
      }
      return child;
    },
    removeChild: (child) => {
      const currentContent = output.get();
      const index = currentContent.indexOf(child);
      if (index < 0) {
        // Do Nothing
      } else {
        output.set(
          currentContent
            .slice(0, index)
            .concat(currentContent.slice(index + 1)),
        );
      }
      return child;
    },
    hasChild: (child) => {
      return output.get().includes(child);
    },
    findChild: (filter) => {
      return output.get().find(filter);
    },
  };

  return new Proxy(output, {
    get: (target, prop) => {
      if (methods.hasOwnProperty(prop)) {
        return methods[prop];
      } else if (prop === "deepFlat") {
        if (flattened === null) flattened = deepFlat(output);
        return flattened;
      }
      return Reflect.get(target, prop);
    },
  });
}

export default convertFunctionToConstructor(createEntityList);

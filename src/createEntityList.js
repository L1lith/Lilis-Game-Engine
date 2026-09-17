import { convertFunctionToConstructor } from "jabr";
import { Signal, isSignal, isStore } from "jabr";
import Entity from "./createEntity";

function deepFlat(entityListOrEntity) {
  const outputSignal = Signal([]);
  const registeredListeners = new WeakSet();

  const isSignalLike = (v) =>
    v != null &&
    typeof v === "object" &&
    typeof v.get === "function" &&
    typeof v.addListener === "function";

  const flatten = (value) => {
    if (isSignalLike(value)) {
      if (!registeredListeners.has(value)) {
        registeredListeners.add(value);
        value.addListener(() => updateOutput());
      }

      const currentValue = value.get();
      if (Array.isArray(currentValue)) {
        return currentValue.flatMap((item) => flatten(item));
      }
      return flatten(currentValue);
    }

    // Plain entity object
    if (value != null && typeof value === "object") {
      return [value];
    }

    return [];
  };

  const updateOutput = () => {
    outputSignal.set(flatten(entityListOrEntity));
  };

  updateOutput();

  return outputSignal;
}

function createEntityList(initialList = []) {
  const output = new Signal(initialList /*, InnerEntityListFormat*/);

  let flattened = null;

  const methods = {
    addChild: (child) => {
      if (
        typeof child === "object" &&
        child !== null &&
        !isStore(child) &&
        !isSignal(child)
      ) {
        // Got a regular object, convert it to an Entity
        child = Entity(child);
      }
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

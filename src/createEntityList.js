import { convertFunctionToConstructor } from "jabr";
import { Signal, isSignal, isStore } from "jabr";
//import InnerEntityListFormat from "./formats/InnerEntityList.js";

function deepFlat(entityListOrEntity) {
  const outputSignal = Signal([]);
  const registeredElements = new Set(); // Tracks all signals and stores currently registered
  const unsubscribeMap = new Map(); // Maps element → cleanup function

  const registerElement = (value) => {
    if (registeredElements.has(value)) return; // Skip if already registered
    registeredElements.add(value);

    if (isSignal(value)) {
      const listener = (newVal, oldVal) => {
        const oldArray = Array.isArray(oldVal) ? oldVal : [];
        const newArray = Array.isArray(newVal) ? newVal : [];
        const added = newArray.filter((v) => !oldArray.includes(v));
        const removed = oldArray.filter((v) => !newArray.includes(v));
        added.forEach(registerElement);
        removed.forEach(unregisterElement);
      };
      value.addListener(listener);
      unsubscribeMap.set(value, () => value.removeListener(listener));
      // Register all current elements
      if (Array.isArray(value.get())) {
        value.get().forEach(registerElement);
      }
    } else if (isStore(value)) {
      // Assumed entity – add to output
      outputSignal.set(outputSignal.get().concat(value));
      // Handle nested children if present
      if (isSignal(value.children)) {
        registerElement(value.children);
        const childrenListener = (newChildren, oldChildren) => {
          if (oldChildren === newChildren) return;
          if (isSignal(oldChildren) || isStore(oldChildren))
            unregisterElement(oldChildren);
          if (isSignal(newChildren) || isStore(newChildren))
            registerElement(newChildren);
        };
        value.addListener("children", childrenListener);
        const cleanup = () =>
          value.removeListener("children", childrenListener);
        // Combine with any existing cleanup for this store
        const existingCleanup = unsubscribeMap.get(value);
        unsubscribeMap.set(value, () => {
          if (existingCleanup) existingCleanup();
          cleanup();
        });
      }
    }
  };

  const unregisterElement = (value) => {
    if (!registeredElements.has(value)) return;
    registeredElements.delete(value);

    // Remove the store from the output if it is an entity
    if (isStore(value)) {
      const currentOutput = outputSignal.get();
      const index = currentOutput.indexOf(value);
      if (index >= 0) {
        outputSignal.set(
          currentOutput.slice(0, index).concat(currentOutput.slice(index + 1)),
        );
      }
    }

    // Recursively unregister children
    if (isSignal(value)) {
      if (Array.isArray(value.get())) value.get().forEach(unregisterElement);
    } else if (isStore(value) && isSignal(value.children)) {
      unregisterElement(value.children);
    }

    // Invoke cleanup
    const cleanup = unsubscribeMap.get(value);
    if (cleanup) {
      cleanup();
      unsubscribeMap.delete(value);
    }
  };

  registerElement(entityListOrEntity);
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

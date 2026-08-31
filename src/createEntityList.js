import { convertFunctionToConstructor } from "jabr";
import { Signal, isSignal, isStore } from "jabr";
import InnerEntityListFormat from "./formats/InnerEntityList.js";

function deepFlat(entityListOrEntity) {
  const outputSignal = Signal([]);
  let unsubscribeHandlers = [];
  let signalListener;

  const registerElement = (value) => {
    if (isSignal(value)) {
      value.addListener(signalListener);
      unsubscribeHandlers.push([
        value,
        () => value.removeListener(signalListener),
      ]);
      if (Array.isArray(value.get())) value.get().forEach(registerElement);
    } else if (isStore(value)) {
      // Assumed Entity
      outputSignal.set(outputSignal.get().concat(value));
      if (isSignal(value.children)) {
        registerElement(value.children);
      }
      const childrenListener = (newChildren, oldChildren) => {
        if (oldChildren === newChildren) return;
        if (isSignal(oldChildren) || isStore(oldChildren))
          unregisterElement(oldChildren);
        if (isSignal(newChildren) || isStore(newChildren))
          registerElement(newChildren);
      };
      value.addListener("children", childrenListener);
      unsubscribeHandlers.push([
        value,
        () => {
          value.removeListener("children", childrenListener);
        },
      ]);
    } else {
      console.warn("Got a value that isn't a signal or a store.");
    }
  };

  const unregisterElement = (value) => {
    if (!isSignal(value) && !isStore(value)) return;

    // 1) Recursively unregister all descendants FIRST
    if (isSignal(value)) {
      const current = value.get();
      if (Array.isArray(current)) current.forEach(unregisterElement);
    } else if (isStore(value)) {
      if (isSignal(value.children)) unregisterElement(value.children);
    }

    // 2) Remove the value itself from the output
    const currentOutput = outputSignal.get();
    const outputIndex = currentOutput.indexOf(value);
    if (outputIndex >= 0) {
      outputSignal.set(
        currentOutput
          .slice(0, outputIndex)
          .concat(currentOutput.slice(outputIndex + 1)),
      );
    }

    // 3) Remove and invoke its unsubscribe handler
    const handlerIndex = unsubscribeHandlers.findIndex(
      ([element]) => element === value,
    );
    if (handlerIndex >= 0) {
      const handler = unsubscribeHandlers[handlerIndex][1];
      unsubscribeHandlers = unsubscribeHandlers
        .slice(0, handlerIndex)
        .concat(unsubscribeHandlers.slice(handlerIndex + 1));
      handler();
    }
  };

  signalListener = (newValue, oldValue) => {
    const isNewArray = Array.isArray(newValue);
    const isOldArray = Array.isArray(oldValue);
    if (isOldArray && isNewArray) {
      const newElements = newValue.filter((value) => !oldValue.includes(value));
      const removedElements = oldValue.filter(
        (value) => !newValue.includes(value),
      );
      newElements.forEach(registerElement);
      removedElements.forEach(unregisterElement);
    } else if (isOldArray) {
      oldValue.forEach(unregisterElement);
    } else if (isNewArray) {
      newValue.forEach(registerElement); // was: newElements (undefined)
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

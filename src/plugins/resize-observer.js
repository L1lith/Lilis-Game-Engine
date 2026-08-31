import { Signal, convertFunctionToConstructor } from "jabr";

function createResizeObserverPlugin(initialReferenceElement, callback) {
  // TODO: Create a system for observing multiple things/adding or removing observations dynamically
  let callbacks = [];
  if (typeof callback == "function") callbacks.push(callback);
  const referenceElement = Signal(null);
  const dimensions = Signal(null);

  let observer;

  const observeReference = (newReference, oldReference) => {
    if (oldReference instanceof HTMLElement) {
      observer.unobserve(oldReference);
    }
    if (newReference instanceof HTMLElement) {
      console.log("observing", newReference);
      observer.observe(newReference);
    }
  };

  const mount = () => {
    observer = new ResizeObserver((entries) => {
      if (entries.length !== 1) throw new Error("Unexpected entries length");
      const resizeData = entries[0];
      const { width, height } = resizeData.contentRect;
      dimensions.set({ width, height, resizeData });
      callbacks.forEach((callback) =>
        callback(dimensions.get(), referenceElement.get()),
      );
    });
    referenceElement.addListener(observeReference);
    if (initialReferenceElement !== null)
      referenceElement.set(
        initialReferenceElement instanceof HTMLElement
          ? initialReferenceElement
          : document.body,
      );
  };
  const unmount = () => {
    referenceElement.set(null);
    referenceElement.removeListener(observeReference);
    observer = null;
    dimensions.set(null);
  };
  const addListener = (fn) => {
    if (typeof fn != "function") throw new Error("Supply a valid function");
    if (!callbacks.includes(fn)) callbacks.push(fn);
  };
  const removeListener = (fn) => {
    if (typeof fn != "function") throw new Error("Supply a valid function");
    if (callbacks.includes(fn))
      callbacks = callbacks.filter((compare) => compare !== fn);
  };
  return {
    mount,
    unmount,
    referenceElement,
    dimensions,
    addListener,
    removeListener,
  };
}

export default convertFunctionToConstructor(createResizeObserverPlugin);

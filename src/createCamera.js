import { Store, convertFunctionToConstructor } from "jabr";

export function applyCameraTransform(entityValue, cameraPos, cameraSize) {
  // All values are in 0-100 percentage space
  // Apply camera transformation (pan and zoom)
  const zoomFactor = 100 / cameraSize;
  return (entityValue - cameraPos) * zoomFactor;
}

function createCamera(state = {}) {
  const store = new Store({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    transformX: (x) => applyCameraTransform(x, store.x, store.width),
    transformY: (y) => applyCameraTransform(y, store.y, store.height),
    ...state,
  });
  return store;
}

export default convertFunctionToConstructor(createCamera);

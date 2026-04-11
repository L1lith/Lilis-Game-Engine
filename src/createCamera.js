import { Store, convertFunctionToConstructor } from "jabr";

export function applyCameraTransform(entityValue, cameraPos, cameraSize) {
  // Convert percentage to pixels based on canvas size
  const pixelPos = entityValue / 100;

  // Apply camera transformation (pan and zoom)
  const zoomFactor = 100 / cameraSize;
  return (pixelPos - cameraPos / 100) * zoomFactor;
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
}

export default convertFunctionToConstructor(createCamera);

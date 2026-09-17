import { Store, convertFunctionToConstructor } from "jabr";

export function applyCameraTransform(entityValue, cameraPos, cameraSize) {
  // All values are in 0-100 percentage space
  // Apply camera transformation (pan and zoom)
  const zoomFactor = 100 / cameraSize;
  return (entityValue - cameraPos) * zoomFactor;
}

export function applyCameraSizeTransform(entityValue, cameraSize) {
  // Only apply zoom to size, not pan
  const zoomFactor = 100 / cameraSize;
  return entityValue * zoomFactor;
}

export function inverseCameraTransform(screenValue, cameraPos, cameraSize) {
  // Convert from screen space back to world space
  const zoomFactor = 100 / cameraSize;
  return screenValue / zoomFactor + cameraPos;
}

export function inverseCameraSizeTransform(screenValue, cameraSize) {
  // Convert screen size back to world size
  const zoomFactor = 100 / cameraSize;
  return screenValue / zoomFactor;
}

function createBoundsSizeListener(store, dimension = "width") {
  return (newSize) => {
    const { bounds } = store;
    if (typeof bounds != "object" || bounds === null) return;
    if (
      dimension === "width"
        ? !isFinite(bounds.left) || !isFinite(bounds.right)
        : !isFinite(bounds.top) || !isFinite(bounds.bottom)
    )
      return; // Invalid bounds
    const maxSize =
      dimension === "width"
        ? bounds.right - bounds.left
        : bounds.bottom - bounds.top;
    if (newSize > maxSize) store[dimension] = maxSize;
  };
}

function createBoundsPositionListener(store, bound) {
  if (bound === "x") {
    return (newX) => {
      let boundedX = newX;
      const { bounds } = store;
      if (typeof bounds != "object" || bounds === null) return;
      if (isFinite(bounds.left))
        boundedX = Math.max(boundedX, bounds.left + store.width / 2);
      if (isFinite(bounds.right))
        boundedX = Math.min(boundedX, bounds.right - store.width / 2);
      store.x = boundedX;
    };
  } else if (bound === "y") {
    return (newY) => {
      let boundedY = newY;
      const { bounds } = store;
      if (typeof bounds != "object" || bounds === null) return;
      if (isFinite(bounds.top))
        boundedY = Math.max(boundedY, bounds.top + store.height / 2);
      if (isFinite(bounds.bottom))
        boundedY = Math.min(boundedY, bounds.bottom - store.height / 2);
      store.y = boundedY;
    };
  } else {
    throw new Error("internal error: invalid bound value");
  }
}

function createCamera(state = {}) {
  const store = new Store({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    transformX: (x) => applyCameraTransform(x, store.x, store.width),
    transformY: (y) => applyCameraTransform(y, store.y, store.height),
    transformWidth: (width) => applyCameraSizeTransform(width, store.width),
    transformHeight: (height) => applyCameraSizeTransform(height, store.height),
    inverseTransformX: (screenX) =>
      inverseCameraTransform(screenX, store.x, store.width),
    inverseTransformY: (screenY) =>
      inverseCameraTransform(screenY, store.y, store.height),
    inverseTransformWidth: (screenWidth) =>
      inverseCameraSizeTransform(screenWidth, store.width),
    inverseTransformHeight: (screenHeight) =>
      inverseCameraSizeTransform(screenHeight, store.height),
    ...state,
  });
  const boundsPositionListenerX = createBoundsPositionListener(store, "x");
  const boundsPositionListenerY = createBoundsPositionListener(store, "y");
  const boundsWidthListener = createBoundsSizeListener(store, "width");
  const boundsHeightListener = createBoundsSizeListener(store, "height");
  store.addListener("x", boundsPositionListenerX);
  store.addListener("y", boundsPositionListenerY);
  store.addListener("width", boundsWidthListener);
  store.addListener("height", boundsHeightListener);
  boundsPositionListenerX(store.x); // Ensure bounds are enforced before returning
  boundsPositionListenerY(store.y);
  boundsWidthListener(store.width);
  boundsHeightListener(store.height);
  return store;
}

export default convertFunctionToConstructor(createCamera);

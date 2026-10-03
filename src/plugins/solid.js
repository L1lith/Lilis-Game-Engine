import { untrack, from, createEffect, createRoot } from "solid-js";
import {
  convertFunctionToConstructor,
  createSignal,
  Store,
  isStore,
  isSignal,
} from "jabr";

function createSolidGetter(jabrSignal) {
  return from((set) => {
    const changeListener = (newValue) => {
      set(newValue);
    };
    jabrSignal.addListener(changeListener);
    return () => jabrSignal.removeListener(changeListener);
  }, jabrSignal.get());
}

/**
 * Build a wrapper <div> around a child element that positions and sizes it
 * to match the -50..+50 world grid, mapped to 0%..100% CSS space. Camera
 * transforms are delegated to the caller's camera object (whatever module
 * they supplied via settings.camera), so any zoom/pan semantics the camera
 * defines are respected without the renderer reimplementing them.
 */
function createPositionWrapper(
  entity,
  childElement,
  camera,
  createSolidGetter,
) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "absolute";
  wrapper.style.transformOrigin = "center";
  wrapper.style.left = "0%";
  wrapper.style.top = "0%";
  wrapper.style.width = "0%";
  wrapper.style.height = "0%";
  wrapper.style.willChange = "left, top, width, height, transform";
  wrapper.appendChild(childElement);

  const dispose = createRoot((dispose) => {
    // --- Entity signals -------------------------------------------------
    const getX = createSolidGetter(entity.getSignal("x"));
    const getY = createSolidGetter(entity.getSignal("y"));
    const getRenderX = createSolidGetter(entity.getSignal("renderX"));
    const getRenderY = createSolidGetter(entity.getSignal("renderY"));
    const getWidth = createSolidGetter(entity.getSignal("width"));
    const getHeight = createSolidGetter(entity.getSignal("height"));
    const getRenderScale = createSolidGetter(entity.getSignal("renderScale"));
    const getRenderXScale = createSolidGetter(entity.getSignal("renderXScale"));
    const getRenderYScale = createSolidGetter(entity.getSignal("renderYScale"));
    const getRotation = createSolidGetter(entity.getSignal("rotation"));
    const getRenderRotation = createSolidGetter(
      entity.getSignal("renderRotation"),
    );
    const getIgnoreSceneCamera = createSolidGetter(
      entity.getSignal("ignoreSceneCamera"),
    );

    // --- Camera reactivity ----------------------------------------------
    // The camera owns the transform math; we only need to know when the
    // inputs it reads from might have changed, so we subscribe to whichever
    // of the standard camera properties it exposes as signals.
    let getCameraX = null;
    let getCameraY = null;
    let getCameraWidth = null;
    let getCameraHeight = null;
    if (isSignal(camera)) {
      getCameraX = createSolidGetter(camera.getSignal("x"));
      getCameraY = createSolidGetter(camera.getSignal("y"));
      getCameraWidth = createSolidGetter(camera.getSignal("width"));
      getCameraHeight = createSolidGetter(camera.getSignal("height"));
    }

    createEffect(() => {
      const x = isFinite(getRenderX())
        ? getRenderX()
        : isFinite(getX())
          ? getX()
          : 0;
      const y = isFinite(getRenderY())
        ? getRenderY()
        : isFinite(getY())
          ? getY()
          : 0;

      const xScale = isFinite(getRenderXScale())
        ? getRenderXScale()
        : isFinite(getRenderScale())
          ? getRenderScale()
          : 1;
      const yScale = isFinite(getRenderYScale())
        ? getRenderYScale()
        : isFinite(getRenderScale())
          ? getRenderScale()
          : 1;

      const worldWidth = (isFinite(getWidth()) ? getWidth() : 100) * xScale;
      const worldHeight = (isFinite(getHeight()) ? getHeight() : 100) * yScale;

      const rotation = isFinite(getRenderRotation())
        ? getRenderRotation()
        : isFinite(getRotation())
          ? getRotation()
          : 0;

      const ignoreCamera = getIgnoreSceneCamera() === true;

      // Register reactive dependencies on camera state even though we
      // delegate the actual math to the camera's own methods.
      if (getCameraX) getCameraX();
      if (getCameraY) getCameraY();
      if (getCameraWidth) getCameraWidth();
      if (getCameraHeight) getCameraHeight();

      let screenX = x;
      let screenY = y;
      let screenWidth = worldWidth;
      let screenHeight = worldHeight;

      if (!ignoreCamera && camera) {
        if (typeof camera.transformX === "function")
          screenX = camera.transformX(x);
        if (typeof camera.transformY === "function")
          screenY = camera.transformY(y);
        if (typeof camera.transformWidth === "function")
          screenWidth = camera.transformWidth(worldWidth);
        if (typeof camera.transformHeight === "function")
          screenHeight = camera.transformHeight(worldHeight);
      }

      // World is -50..+50, so `+50` recenters it to 0..100 CSS percent.
      wrapper.style.left = `${screenX + 50}%`;
      wrapper.style.top = `${screenY + 50}%`;
      wrapper.style.width = `${screenWidth}%`;
      wrapper.style.height = `${screenHeight}%`;
      wrapper.style.transform = `translate(-50%, -50%) rotate(${rotation}rad)`;
    });

    return dispose;
  });

  return { element: wrapper, dispose };
}

function createSolidRenderer(entities, settings = {}) {
  if (!isStore(settings)) settings = Store(settings);
  entities = entities.deepFlat;
  const { solidSetter } = settings;

  const {
    get: getSolidChildren,
    set: setSolidChildren,
    self: childrenSignal,
    addListener: addChildrenListener,
    removeListener: removeChildrenListener,
  } = createSignal([]);

  let currentCamera = settings.camera ?? null;

  // Effective positionTransform for an entity: explicit value wins, else
  // falls back to the plugin's default (which itself defaults to false).
  const getEffectivePositionTransform = (entity) => {
    if (entity.positionTransform !== undefined)
      return entity.positionTransform === true;
    return settings.defaultPositionTransform === true;
  };

  const destroyWrappedComponent = (entity) => {
    if (!entity._wrappedComponent) return;
    setSolidChildren(
      getSolidChildren().filter((el) => el !== entity._wrappedComponent),
    );
    if (typeof entity._disposePositionWrapper === "function") {
      entity._disposePositionWrapper();
      entity._disposePositionWrapper = null;
    }
    entity._wrappedComponent = null;
  };

  // Build the raw child element from entity.solid. Supports function
  // components and HTMLElements.
  const buildChildElement = (entity) => {
    if (typeof entity.solid === "function") {
      const SolidComponent = entity.solid;
      const getReactiveProp = (propName) =>
        createSolidGetter(entity.getSignal(propName));
      return untrack(() =>
        SolidComponent({ entity, getReactiveProp, createSolidGetter }),
      );
    }
    if (
      typeof HTMLElement !== "undefined" &&
      entity.solid instanceof HTMLElement
    ) {
      return entity.solid;
    }
    return null;
  };

  const renderEntity = (entity) => {
    const positionTransform = getEffectivePositionTransform(entity);

    // Cheap bail-out if nothing we care about changed.
    if (
      entity._lastSolidValue === entity.solid &&
      entity._lastPositionTransform === positionTransform &&
      entity._lastCamera === currentCamera
    ) {
      return;
    }

    destroyWrappedComponent(entity);

    const child = buildChildElement(entity);

    if (child) {
      if (positionTransform) {
        const { element, dispose } = createPositionWrapper(
          entity,
          child,
          currentCamera,
          createSolidGetter,
        );
        entity._wrappedComponent = element;
        entity._disposePositionWrapper = dispose;
      } else {
        entity._wrappedComponent = child;
      }
      setSolidChildren(getSolidChildren().concat([entity._wrappedComponent]));
    }

    entity._lastSolidValue = entity.solid;
    entity._lastPositionTransform = positionTransform;
    entity._lastCamera = currentCamera;
  };

  const mountEntity = (entity) => {
    entity._renderSolid = () => renderEntity(entity);
    entity.on("solid", entity._renderSolid);
    entity.on("positionTransform", entity._renderSolid);
    if ("solid" in entity) entity._renderSolid();
  };

  const unmountEntity = (entity) => {
    if (typeof entity._renderSolid !== "function")
      return console.warn("Unable to locate render function for: ", entity);
    entity.off("solid", entity._renderSolid);
    entity.off("positionTransform", entity._renderSolid);
    destroyWrappedComponent(entity);
  };

  const entityListListener = (newEntityList, oldEntityList) => {
    const newEntities = newEntityList.filter(
      (entity) => !oldEntityList.includes(entity),
    );
    const removedEntities = oldEntityList.filter(
      (entity) => !newEntityList.includes(entity),
    );
    newEntities.forEach(mountEntity);
    removedEntities.forEach(unmountEntity);
  };

  const solidUpdater = (newChildren) => {
    solidSetter(newChildren);
  };

  // When the camera changes, every wrapped component needs to be rebuilt
  // so it picks up the new camera's signals.
  const cameraListener = () => {
    const nextCamera = settings.camera ?? null;
    if (nextCamera === currentCamera) return;
    currentCamera = nextCamera;
    entities.get().forEach((entity) => {
      if (typeof entity._renderSolid !== "function") return;
      entity._lastCamera = undefined;
      entity._renderSolid();
    });
  };

  // When the default flips, only entities with no explicit value need to
  // re-evaluate.
  const defaultPositionTransformListener = () => {
    entities.get().forEach((entity) => {
      if (entity.positionTransform !== undefined) return;
      if (typeof entity._renderSolid !== "function") return;
      entity._lastPositionTransform = undefined;
      entity._renderSolid();
    });
  };

  const mount = () => {
    addChildrenListener(solidUpdater);
    entities.addListener(entityListListener);
    settings.on("camera", cameraListener);
    settings.on("defaultPositionTransform", defaultPositionTransformListener);
    currentCamera = settings.camera ?? null;
    setSolidChildren([]);
    entityListListener(entities.get(), []);
  };

  const unmount = () => {
    removeChildrenListener(solidUpdater);
    entities.removeListener(entityListListener);
    settings.off("camera", cameraListener);
    settings.off("defaultPositionTransform", defaultPositionTransformListener);
    entityListListener([], entities.get());
    setSolidChildren([]);
  };

  return {
    mount,
    unmount,
    solidOutput: createSolidGetter(childrenSignal),
  };
}

export default convertFunctionToConstructor(createSolidRenderer);

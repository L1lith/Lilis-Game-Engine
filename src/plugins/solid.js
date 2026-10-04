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
  // layout containment: changes to left/top/width/height can't invalidate
  //   siblings' layout; the wrapper is its own formatting context.
  // style containment: counters and other stateful styling don't leak out.
  // (paint containment is intentionally omitted so child box-shadows can
  //  extend past the wrapper's box without being clipped.)
  wrapper.style.contain = "layout style";
  // Only `transform` can be composited. The old hint listed left/top/width/
  // height, which the browser can't promote — the layout pass still runs,
  // and the hint just wastes bookkeeping.
  wrapper.style.willChange = "transform";
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
      // Read each signal exactly once. The previous version called each
      // getter up to twice (once for the isFinite check, once for the
      // value), doubling the reactive bookkeeping per frame.
      let x = getRenderX();
      if (!isFinite(x)) x = getX();
      if (!isFinite(x)) x = 0;

      let y = getRenderY();
      if (!isFinite(y)) y = getY();
      if (!isFinite(y)) y = 0;

      let renderScale = getRenderScale();
      if (!isFinite(renderScale)) renderScale = 1;

      let xScale = getRenderXScale();
      if (!isFinite(xScale)) xScale = renderScale;

      let yScale = getRenderYScale();
      if (!isFinite(yScale)) yScale = renderScale;

      let width = getWidth();
      if (!isFinite(width)) width = 100;
      let height = getHeight();
      if (!isFinite(height)) height = 100;

      const worldWidth = width * xScale;
      const worldHeight = height * yScale;

      let rotation = getRenderRotation();
      if (!isFinite(rotation)) rotation = getRotation();
      if (!isFinite(rotation)) rotation = 0;

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
      // Five individual property writes: the browser coalesces them into
      // one style invalidation on the next paint, so no manual batching
      // is needed. (A single cssText assignment would skip four CSSOM
      // parses, but at the cost of restating the static properties every
      // frame — not worth the tradeoff here.)
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

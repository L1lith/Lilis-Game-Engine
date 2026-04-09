import { convertFunctionToConstructor } from "jabr";
import {
  Application,
  Assets,
  Sprite,
  TextureStyle,
  Container,
  autoDetectRenderer,
} from "pixi.js";
import EntityListFormat from "../formats/EntityList.js";
import { valid } from "sandhands";
import RenderSettingsFormat from "../formats/RenderSettings.js";
TextureStyle.defaultOptions.scaleMode = "nearest";

function createPixiRenderer(entities, renderSettings) {
  if (!valid(entities, EntityListFormat))
    throw new Error("Please supply a valid EntityList");
  if (!valid(renderSettings, RenderSettingsFormat))
    throw new Error("Please supply valid RenderSettings");

  // Default camera values
  const defaultCamera = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };

  const pixiSprites = new WeakMap();
  let renderer = null;
  let stage = null;
  let entityListeners = null;
  let cameraListener = null;
  let context = null;
  let isMounted = false;
  let currentCamera = defaultCamera;

  // Apply camera transformation to entity coordinates
  const applyCameraTransform = (
    entityValue,
    canvasSize,
    cameraPos,
    cameraSize,
  ) => {
    // Convert percentage to pixels based on canvas size
    const pixelPos = (entityValue / 100) * canvasSize;

    // Apply camera transformation (pan and zoom)
    const zoomFactor = 100 / cameraSize;
    return (pixelPos - (cameraPos / 100) * canvasSize) * zoomFactor;
  };

  const regenerateRenderer = async () => {
    if (renderer !== null) renderer.destroy({ removeView: false });
    renderer = await autoDetectRenderer({
      view: renderSettings.canvas,
      // you can pass options here (antialias, resolution, etc.)
    });
    context = renderSettings.canvas.getContext("2d");
  };

  const adjustEntitySize = (entity) => {
    const { width: canvasWidth, height: canvasHeight } = renderSettings.canvas;
    const cam = currentCamera;
    const pixiSprite = pixiSprites.get(entity);

    if (isFinite(entity.width)) {
      const zoomFactor = 100 / cam.width;
      pixiSprite.width = (entity.width / 100) * canvasWidth * zoomFactor;
    } else {
      pixiSprite.width = canvasWidth;
    }

    if (isFinite(entity.height)) {
      const zoomFactor = 100 / cam.height;
      pixiSprite.height = (entity.height / 100) * canvasHeight * zoomFactor;
    } else {
      pixiSprite.height = canvasHeight;
    }
  };

  const adjustEntityPosition = (entity) => {
    const { width: canvasWidth, height: canvasHeight } = renderSettings.canvas;
    const cam = currentCamera;
    const pixiSprite = pixiSprites.get(entity);

    if (isFinite(entity.x)) {
      pixiSprite.x = applyCameraTransform(
        entity.x,
        canvasWidth,
        cam.x,
        cam.width,
      );
    } else {
      pixiSprite.x = applyCameraTransform(0, canvasWidth, cam.x, cam.width);
    }

    if (isFinite(entity.y)) {
      pixiSprite.y = applyCameraTransform(
        entity.y,
        canvasHeight,
        cam.y,
        cam.height,
      );
    } else {
      pixiSprite.y = applyCameraTransform(0, canvasHeight, cam.y, cam.height);
    }
  };

  const initializeEntity = async (entity) => {
    if (pixiSprites.has(entity)) return;
    let pixiSprite;
    if (typeof entity?.sprite == "object" && entity?.sprite !== null) {
      pixiSprite = entity.sprite;
    } else {
      let texture =
        entity.texture ||
        (typeof entity.imageURL == "string"
          ? await Assets.load(entity.imageURL)
          : await Assets.load("https://pixijs.com/assets/bunny.png"));
      pixiSprite = new Sprite(texture);
    }
    pixiSprites.set(entity, pixiSprite);
    const adjustSize = () => adjustEntitySize(entity);
    const adjustPosition = () => adjustEntityPosition(entity);

    adjustSize();
    adjustPosition();
    entity.on("x", adjustPosition);
    entity.on("y", adjustPosition);
    entity.on("width", adjustSize);
    entity.on("height", adjustSize);
    entityListeners.set(entity, { adjustSize, adjustPosition });
    entity.pixiSprite = pixiSprite;
    stage.addChild(pixiSprite);
  };

  const entityListener = (newEntities, oldEntities) => {
    newEntities.forEach(initializeEntity);
    const destroyedEntities = oldEntities.filter(
      (entity) => !newEntities.includes(entity),
    );
    destroyedEntities.forEach(destroyEntity);
  };

  const destroyEntity = (entity) => {
    if (pixiSprites.has(entity)) {
      stage.removeChild(pixiSprites.get(entity));
      pixiSprites.delete(entity);
    }
  };

  const handleCameraChange = () => {
    // Recalculate all entity positions and sizes when camera changes
    entities.get().forEach((entity) => {
      if (pixiSprites.has(entity)) {
        adjustEntityPosition(entity);
        adjustEntitySize(entity);
      }
    });
  };

  const handleCanvasResize = () => {
    const canvas = renderSettings.canvas;
    if (!canvas || !renderer)
      return console.warn(
        "Could not find the canvas or the render, resizing failed",
      );

    const { width, height } = renderSettings.canvas;
    if (renderer.width !== width || renderer.height !== height) {
      renderer.resize(width, height);
    }
    entities.get().forEach((entity) => {
      if (pixiSprites.has(entity)) {
        adjustEntityPosition(entity);
        adjustEntitySize(entity);
      }
    });
  };

  const canvasListener = async (canvas) => {
    await regenerateRenderer();
  };

  const mount = async () => {
    if (renderSettings.canvas === null)
      throw new Error("Cannot mount without a canvas");
    await regenerateRenderer();
    stage = new Container();
    window.stage = stage;
    entityListeners = new WeakMap();

    // Set up camera listener if camera property exists
    const unmountCamera = (oldCamera) => {
      oldCamera.off("x", handleCameraChange);
      oldCamera.off("y", handleCameraChange);
      oldCamera.off("width", handleCameraChange);
      camera.off("height", handleCameraChange);
    };
    cameraListener = () => {
      if (
        typeof renderSettings.camera == "object" &&
        renderSettings.camera !== null
      ) {
        const oldCamera = currentCamera;
        if (
          typeof oldCamera == "object" &&
          oldCamera !== null &&
          oldCamera !== defaultCamera
        ) {
          unmountCamera(oldCamera);
        }
        currentCamera = renderSettings.camera;
        currentCamera.on("x", handleCameraChange);
        currentCamera.on("y", handleCameraChange);
        currentCamera.on("width", handleCameraChange);
        currentCamera.on("height", handleCameraChange);
      } else {
        currentCamera = defaultCamera;
      }
      handleCameraChange();
    };

    // Listen for camera property changes
    renderSettings.on("camera", cameraListener);
    // Set initial camera state
    cameraListener();

    await Promise.all(entities.get().map(initializeEntity));
    entities.addListener(entityListener);
    renderSettings.on("canvas", canvasListener);
    isMounted = true;
  };

  const unmount = () => {
    renderer.destroy({ removeView: false });
    renderer = null;
    entities.get().forEach(destroyEntity);
    entities.removeListener(entityListener);

    // Remove camera listeners
    renderSettings.off("camera", cameraListener);
    // Unmount Camera
    if (
      typeof renderSettings.camera == "camera" &&
      renderSettings.camera !== null
    ) {
      unmountCamera(renderSettings.camera);
    }

    entityListeners = null;
    cameraListener = null;
    stage = null;
    context = null;
    renderSettings.off("canvas", canvasListener);
    isMounted = false;
  };

  const render = async () => {
    if (!isMounted) throw new Error("Cannot render while unmounted");
    renderer.render(stage);
  };

  const checkMounted = () => {
    return isMounted;
  };

  return { mount, unmount, render, handleCanvasResize, types: ["renderer"] };
}

export default convertFunctionToConstructor(createPixiRenderer);

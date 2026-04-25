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
import worldToScreenPosition from "../utility/worldToScreenPosition.js";
import worldToScreenSize from "../utility/worldToScreenSize.js";

TextureStyle.defaultOptions.scaleMode = "nearest";

function createPixiRenderer(entities, renderSettings) {
  if (!valid(entities, EntityListFormat))
    throw new Error("Please supply a valid EntityList");

  if (!valid(renderSettings, RenderSettingsFormat))
    throw new Error("Please supply valid RenderSettings");

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

  let isMounted = false;
  let isRegenerating = false;

  let currentCanvas = null;
  let currentCamera = defaultCamera;

  let dirtyCamera = true;
  let dirtyEntities = [];

  let cameraListener = null;
  let entityListListener = null;

  const getCanvasWidth = () =>
    renderSettings.width || renderSettings.canvas?.width || 1;

  const getCanvasHeight = () =>
    renderSettings.height || renderSettings.canvas?.height || 1;

  const markDirtyCamera = () => {
    dirtyCamera = true;
  };

  const markEntityDirty = (entity) => {
    if (!dirtyEntities.includes(entity)) {
      dirtyEntities.push(entity);
    }
  };

  const regenerateRenderer = async () => {
    if (isRegenerating) return;
    if (!renderSettings.canvas) return;

    isRegenerating = true;

    if (renderer) {
      renderer.destroy({ removeView: false });
      renderer = null;
    }

    renderer = await autoDetectRenderer({
      view: renderSettings.canvas,
      width: getCanvasWidth(),
      height: getCanvasHeight(),
    });

    isRegenerating = false;
  };

  const resizeRenderer = () => {
    if (!renderer) return;

    const width = getCanvasWidth();
    const height = getCanvasHeight();

    if (renderer.width !== width || renderer.height !== height) {
      renderer.resize(width, height);
      markDirtyCamera();
    }
  };

  const adjustEntityPosition = (entity) => {
    const pixiSprite = pixiSprites.get(entity);
    if (!pixiSprite) return;

    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();

    const camera = renderSettings.camera;

    let outputX = entity.x || 0;
    let outputY = entity.y || 0;

    if (!entity.ignoreSceneCamera && typeof camera?.transformX === "function") {
      outputX = camera.transformX(outputX);
    }

    if (!entity.ignoreSceneCamera && typeof camera?.transformY === "function") {
      outputY = camera.transformY(outputY);
    }

    const coords = worldToScreenPosition(
      outputX,
      outputY,
      canvasWidth,
      canvasHeight,
    );

    pixiSprite.position.set(coords.x, coords.y);
  };

  const adjustEntitySize = (entity) => {
    const pixiSprite = pixiSprites.get(entity);
    if (!pixiSprite) return;

    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();

    const camera = renderSettings.camera;

    const renderXScale = Number.isFinite(entity.renderXScale)
      ? entity.renderXScale
      : Number.isFinite(entity.renderScale)
        ? entity.renderScale
        : 1;

    const renderYScale = Number.isFinite(entity.renderYScale)
      ? entity.renderYScale
      : Number.isFinite(entity.renderScale)
        ? entity.renderScale
        : 1;

    let outputWidth = (entity.width || 100) * renderXScale;
    let outputHeight = (entity.height || 100) * renderYScale;

    if (
      !entity.ignoreSceneCamera &&
      typeof camera?.transformWidth === "function"
    ) {
      outputWidth = camera.transformWidth(outputWidth);
    }

    if (
      !entity.ignoreSceneCamera &&
      typeof camera?.transformHeight === "function"
    ) {
      outputHeight = camera.transformHeight(outputHeight);
    }

    const finalSize = worldToScreenSize(
      outputWidth,
      outputHeight,
      canvasWidth,
      canvasHeight,
    );

    if (pixiSprite.pivot._x === 0 && pixiSprite.pivot._y === 0)
      pixiSprite.pivot.set(pixiSprite.width / 2, pixiSprite.height / 2);

    pixiSprite.width = finalSize.width;
    pixiSprite.height = finalSize.height;
  };

  const adjustEntityRotation = (entity) => {
    const pixiSprite = pixiSprites.get(entity);
    if (!pixiSprite) return;

    if (Number.isFinite(entity.rotation)) {
      pixiSprite.rotation = entity.rotation;
    }
  };

  const updateEntity = (entity) => {
    if (entity.noRender) return;
    if (!pixiSprites.has(entity)) return;

    adjustEntityPosition(entity);
    adjustEntitySize(entity);
    adjustEntityRotation(entity);
  };

  const updateAllEntities = () => {
    entities.get().forEach(updateEntity);
  };

  const initializeEntity = async (entity) => {
    if (entity.noRender) return;
    if (pixiSprites.has(entity)) return;

    let pixiSprite;

    if (entity?.sprite && typeof entity.sprite === "object") {
      pixiSprite = entity.sprite;
    } else {
      const texture =
        entity.texture ||
        (typeof entity.imageURL === "string"
          ? await Assets.load(entity.imageURL)
          : await Assets.load("https://pixijs.com/assets/bunny.png"));

      pixiSprite = new Sprite(texture);
    }

    pixiSprites.set(entity, pixiSprite);
    entity.pixiSprite = pixiSprite;

    const onDirty = () => markEntityDirty(entity);

    entity.on("x", onDirty);
    entity.on("y", onDirty);
    entity.on("width", onDirty);
    entity.on("height", onDirty);
    entity.on("rotation", onDirty);
    entity.on("renderXScale", onDirty);
    entity.on("renderYScale", onDirty);
    entity.on("renderScale", onDirty);
    entity.on("noRender", onDirty);

    entityListeners.set(entity, onDirty);

    stage.addChild(pixiSprite);

    updateEntity(entity);
  };

  const destroyEntity = (entity) => {
    const pixiSprite = pixiSprites.get(entity);

    if (!pixiSprite) return;

    const listener = entityListeners.get(entity);

    if (listener) {
      entity.off("x", listener);
      entity.off("y", listener);
      entity.off("width", listener);
      entity.off("height", listener);
      entity.off("rotation", listener);
      entity.off("renderXScale", listener);
      entity.off("renderYScale", listener);
      entity.off("renderScale", listener);
      entity.off("noRender", listener);
    }

    if (stage) {
      stage.removeChild(pixiSprite);
    }

    pixiSprites.delete(entity);
    entityListeners.delete(entity);
  };

  entityListListener = (newEntities, oldEntities) => {
    newEntities.forEach(initializeEntity);

    oldEntities
      .filter((entity) => !newEntities.includes(entity))
      .forEach(destroyEntity);
  };

  const unmountCamera = (camera) => {
    if (!camera || typeof camera !== "object") return;

    camera.off("x", markDirtyCamera);
    camera.off("y", markDirtyCamera);
    camera.off("width", markDirtyCamera);
    camera.off("height", markDirtyCamera);
  };

  cameraListener = () => {
    const nextCamera =
      renderSettings.camera && typeof renderSettings.camera === "object"
        ? renderSettings.camera
        : defaultCamera;

    if (currentCamera !== nextCamera) {
      if (currentCamera !== defaultCamera) {
        unmountCamera(currentCamera);
      }

      currentCamera = nextCamera;

      if (currentCamera !== defaultCamera) {
        currentCamera.on("x", markDirtyCamera);
        currentCamera.on("y", markDirtyCamera);
        currentCamera.on("width", markDirtyCamera);
        currentCamera.on("height", markDirtyCamera);
      }
    }

    markDirtyCamera();
  };

  const handleCanvasSwap = async () => {
    if (renderSettings.canvas === currentCanvas) return;

    currentCanvas = renderSettings.canvas;

    await regenerateRenderer();
    markDirtyCamera();
  };

  const mount = async () => {
    if (!renderSettings.canvas) {
      throw new Error("Cannot mount without a canvas");
    }

    stage = new Container();
    entityListeners = new WeakMap();

    await handleCanvasSwap();

    renderSettings.on("canvas", handleCanvasSwap);
    renderSettings.on("width", resizeRenderer);
    renderSettings.on("height", resizeRenderer);

    renderSettings.on("camera", cameraListener);
    cameraListener();

    await Promise.all(entities.get().map(initializeEntity));
    entities.addListener(entityListListener);

    isMounted = true;
  };

  const unmount = () => {
    if (!isMounted) return true;

    entities.removeListener(entityListListener);

    renderSettings.off("canvas", handleCanvasSwap);
    renderSettings.off("width", resizeRenderer);
    renderSettings.off("height", resizeRenderer);
    renderSettings.off("camera", cameraListener);

    if (currentCamera !== defaultCamera) {
      unmountCamera(currentCamera);
    }

    entities.get().forEach(destroyEntity);

    if (renderer) {
      renderer.destroy({ removeView: false });
      renderer = null;
    }

    stage = null;
    entityListeners = null;
    currentCanvas = null;
    currentCamera = defaultCamera;

    dirtyEntities = [];
    dirtyCamera = true;

    isMounted = false;

    return true;
  };

  const render = () => {
    if (!isMounted) {
      throw new Error("Cannot render while unmounted");
    }

    if (!renderer || !stage) return;

    if (dirtyCamera) {
      updateAllEntities();
      dirtyCamera = false;
      dirtyEntities = [];
    } else if (dirtyEntities.length > 0) {
      dirtyEntities.forEach(updateEntity);
      dirtyEntities = [];
    }

    renderer.render(stage);
  };

  return {
    mount,
    unmount,
    render,
    markDirty: markDirtyCamera,
    types: ["renderer"],
  };
}

export default convertFunctionToConstructor(createPixiRenderer);

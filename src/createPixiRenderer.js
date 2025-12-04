import {
  Application,
  Assets,
  Sprite,
  TextureStyle,
  Container,
  autoDetectRenderer,
} from "pixi.js";
import EntityListFormat from "./formats/EntityList";
import { valid } from "sandhands";
import RenderSettingsFormat from "./formats/RenderSettings";
TextureStyle.defaultOptions.scaleMode = "nearest";

export default function createPixiRenderer(entities, renderSettings) {
  if (!valid(entities, EntityListFormat))
    throw new Error("Please supply a valid EntityList");
  if (!valid(renderSettings, RenderSettingsFormat))
    throw new Error("Please supply valid RenderSettings");
  const pixiSprites = new WeakMap();
  let renderer = null;
  let stage = null;
  let entityListeners = null;
  let context = null;
  let isMounted = false;
  const regenerateRenderer = async () => {
    if (renderer !== null) renderer.destroy({ removeView: false });
    renderer = await autoDetectRenderer({
      view: renderSettings.canvas,
      // you can pass options here (antialias, resolution, etc.)
    });
    context = renderSettings.canvas.getContext("2d");
  };
  const adjustEntitySize = (entity) => {
    const { width, height } = renderSettings.canvas;
    const pixiSprite = pixiSprites.get(entity);
    if (isFinite(entity.width)) {
      pixiSprite.width = (entity.width / 100) * width;
    } else {
      pixiSprite.width = width;
    }
    if (isFinite(entity.height)) {
      pixiSprite.height = (entity.height / 100) * height;
    } else {
      pixiSprite.height = height;
    }
  };
  const adjustEntityPosition = (entity) => {
    const { width, height } = renderSettings.canvas;
    const pixiSprite = pixiSprites.get(entity);
    if (isFinite(entity.x)) {
      pixiSprite.x = (entity.x / 100) * width;
    } else {
      pixiSprite.x = 0;
    }
    if (isFinite(entity.y)) {
      pixiSprite.y = (entity.y / 100) * height;
    } else {
      pixiSprite.y = 0;
    }
  };
  const initializeEntity = async (entity) => {
    if (pixiSprites.has(entity)) return;
    let texture =
      entity.texture ||
      (typeof entity.imageURL == "string"
        ? await Assets.load(entity.imageURL)
        : await Assets.load("https://pixijs.com/assets/bunny.png"));
    const pixiSprite = new Sprite(texture);
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
      (entity) => !newEntities.includes(entity)
    );
    destroyedEntities.forEach(destroyEntity);
  };
  const destroyEntity = (entity) => {
    if (pixiSprites.has(entity)) {
      stage.removeChild(pixiSprites.get(entity));
      pixiSprites.delete(entity);
    }
    if (entityListeners.has(entity)) {
      const listeners = entityListeners.get(entity);
      entity.off("x", listeners.adjustPosition);
      entity.off("y", listeners.adjustPosition);
      entity.off("width", listeners.adjustSize);
      entity.off("height", listeners.adjustSize);
      entityListeners.delete(entity);
    }
    entity.pixiSprite = null;
  };
  const handleCanvasResize = () => {
    const canvas = renderSettings.canvas;
    if (!canvas || !renderer)
      return console.warn(
        "Could not find the canvas or the render, resizing failed"
      );

    // Pixi renderer width/height reflect its internal buffer size
    const { width, height } = renderSettings.canvas;
    if (renderer.width !== width || renderer.height !== height) {
      renderer.resize(width, height);
    }
    entities.get().forEach((entity) => {
      // Entities are no longer going to fit on the screen correctly as it has been resized, we must now readjust them all
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
    entityListeners = null;
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
    return isMounted();
  };

  return { mount, unmount, render, handleCanvasResize, types: ["renderer"] };
}

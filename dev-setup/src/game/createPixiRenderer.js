import { Application, Assets, Sprite, TextureStyle } from "pixi.js";
import { initDevtools } from "@pixi/devtools";
TextureStyle.defaultOptions.scaleMode = "nearest";

export default async function createPixiRenderer(canvas, entities) {
  const pixiSprites = new WeakMap();
  const app = new Application();
  const entityListeners = new WeakMap();
  await app.init({
    view: canvas, // Use the existing canvas
    width: 800,
    height: 600,
    backgroundColor: 0x1099bb, // Optional: set background color
    antialias: false, // Optional: enable antialiasing
  });
  initDevtools({ app });
  const initializeEntity = async (entity) => {
    if (pixiSprites.has(entity)) return;
    let texture =
      typeof entity.image == "string"
        ? await Assets.load(entity.image)
        : await Assets.load("https://pixijs.com/assets/bunny.png");
    const pixiSprite = new Sprite(texture);
    pixiSprites.set(entity, pixiSprite);
    const adjustPosition = () => {
      if (isFinite(entity.x)) {
        pixiSprite.x = (entity.x / 100) * app.screen.width;
      } else {
        pixiSprite.x = 0;
      }
      if (isFinite(entity.y)) {
        pixiSprite.y = (entity.y / 100) * app.screen.height;
      } else {
        pixiSprite.y = 0;
      }
    };
    const adjustSize = () => {
      if (isFinite(entity.width)) {
        pixiSprite.width = (entity.width / 100) * app.screen.width;
      } else {
        pixiSprite.width = app.screen.width;
      }
      if (isFinite(entity.height)) {
        pixiSprite.height = (entity.height / 100) * app.screen.height;
      } else {
        pixiSprite.height = app.screen.height;
      }
    };
    adjustSize();
    adjustPosition();
    entity.on("x", adjustPosition);
    entity.on("y", adjustPosition);
    entity.on("width", adjustSize);
    entity.on("height", adjustSize);
    entityListeners.set(entity, { adjustSize, adjustPosition });
    app.stage.addChild(pixiSprite);
  };
  entities.addListener((newEntities, oldEntities) => {
    newEntities.forEach(initializeEntity);
    const destroyedEntities = oldEntities.filter(
      (entity) => !newEntities.includes(entity)
    );
    destroyedEntities.forEach(destroyEntity);
  });
  const destroyEntity = (entity) => {
    if (pixiSprites.has(entity)) {
      app.stage.removeChild(pixiSprites.get(entity));
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
  };
  await Promise.all(entities.get().map(initializeEntity));

  const stop = () => {
    entities.get().forEach(destroyEntity);
  };

  const render = { app, stop };
  return render;
}

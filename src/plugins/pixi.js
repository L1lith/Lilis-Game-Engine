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
  let dirtyCamera = false;
  let dirtyEntities = [];

  // const toCanvasPixels = (transformedValue, canvasSize) => {
  //   return (transformedValue / 100) * canvasSize;
  // };
  const regenerateRenderer = async () => {
    if (renderer !== null) renderer.destroy({ removeView: false });
    renderer = await autoDetectRenderer({
      view: renderSettings.canvas,
      // you can pass options here (antialias, resolution, etc.)
    });
    context = renderSettings.canvas.getContext("2d");
  };
  const adjustEntitySize = (entity) => {
    const { width: canvasWidth, height: canvasHeight } =
      renderSettings.canvas.getBoundingClientRect();
    const camera = renderSettings.camera;
    const pixiSprite = pixiSprites.get(entity);

    let outputWidth = entity.width || 100;
    if (
      !entity.ignoreSceneCamera &&
      typeof camera?.transformWidth == "function"
    )
      outputWidth = camera.transformWidth(entity.width);

    let outputHeight = entity.height || 100;
    if (
      !entity.ignoreSceneCamera &&
      typeof camera?.transformHeight == "function"
    )
      outputHeight = camera.transformHeight(entity.height);
    //if (pixiSprite.pivot._x === 0 && pixiSprite.pivot._y === 0)
    //pixiSprite.pivot.set(pixiSprite.width / 2, pixiSprite.height / 2);
    const finalSizes = worldToScreenSize(
      outputWidth,
      outputHeight,
      canvasWidth,
      canvasHeight,
    );
    if (pixiSprite.pivot._x === 0 && pixiSprite.pivot._y === 0)
      pixiSprite.pivot.set(pixiSprite.width / 2, pixiSprite.height / 2);
    pixiSprite.width = finalSizes.width;
    pixiSprite.height = finalSizes.height;
    //if (pixiSprite.pivot._x === 0 && pixiSprite.pivot._y === 0)
  };

  const adjustEntityPosition = (entity) => {
    const { width: canvasWidth, height: canvasHeight } = renderSettings.canvas;
    const { camera } = renderSettings;
    const pixiSprite = pixiSprites.get(entity);

    let outputX = entity.x || 0;
    if (!entity.ignoreSceneCamera && typeof camera?.transformX == "function")
      outputX = camera.transformX(outputX);
    let outputY = entity.y || 0;
    if (!entity.ignoreSceneCamera && typeof camera?.transformY == "function")
      outputY = camera.transformY(outputY);
    const newCoords = worldToScreenPosition(
      outputX,
      outputY,
      canvasWidth,
      canvasHeight,
    );
    pixiSprite.position.set(newCoords.x, newCoords.y);
  };

  const initializeEntity = async (entity) => {
    if (pixiSprites.has(entity) || entity.noRender) return;
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
    const markEntityDirty = () => {
      if (!dirtyEntities.includes(entity)) dirtyEntities.push(entity);
    };
    entity.on("x", markEntityDirty);
    entity.on("y", markEntityDirty);
    entity.on("width", markEntityDirty);
    entity.on("height", markEntityDirty);
    entityListeners.set(entity, { markEntityDirty });
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

  const markDirtyCamera = () => {
    dirtyCamera = true;
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

    console.log("potential canvas resize");
    const { width, height } = renderSettings.canvas.getBoundingClientRect();

    //stage.pivot.set(width / 2, height / 2);
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
    handleCanvasResize();
    canvas.addEventListener("resize", () => {
      console.log("canvas resized");
    });
  };

  const mount = async () => {
    if (renderSettings.canvas === null)
      throw new Error("Cannot mount without a canvas");
    const { width: canvasWidth, height: canvasHeight } =
      renderSettings.canvas.getBoundingClientRect();
    await regenerateRenderer();
    stage = new Container();
    //window.addEventListener("resize", handleCanvasResize);
    //stage.pivot.set(canvasWidth / 2, canvasHeight / 2);
    window.stage = stage;
    entityListeners = new WeakMap();

    // Set up camera listener if camera property exists
    const unmountCamera = (oldCamera) => {
      oldCamera.off("x", markDirtyCamera);
      oldCamera.off("y", markDirtyCamera);
      oldCamera.off("width", markDirtyCamera);
      camera.off("height", markDirtyCamera);
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
        currentCamera.on("x", markDirtyCamera);
        currentCamera.on("y", markDirtyCamera);
        currentCamera.on("width", markDirtyCamera);
        currentCamera.on("height", markDirtyCamera);
      } else {
        currentCamera = defaultCamera;
      }
      markDirtyCamera();
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
    if (dirtyCamera) {
      handleCameraChange();
      dirtyCamera = false;
    } else if (dirtyEntities.length > 0) {
      dirtyEntities.forEach((entity) => {
        if (entity.noRender) return;
        adjustEntityPosition(entity);
        adjustEntitySize(entity);
      });
    }
    dirtyEntities = [];
    renderer.render(stage);
  };

  const checkMounted = () => {
    return isMounted;
  };

  return { mount, unmount, render, handleCanvasResize, types: ["renderer"] };
}

export default convertFunctionToConstructor(createPixiRenderer);

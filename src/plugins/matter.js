import Matter from "matter-js";
const { Engine, Bodies, Composite, Body, Events, Render } = Matter;
import { Signal, Store, isStore } from "jabr";
import Entity from "../createEntity.js";
import EntityList from "../createEntityList.js";
//import { translateToNewOrigin } from "lilis-engine/utility";

export function createMatterBoundaries(options = {}) {
  const {
    width = 100,
    height = 100,
    thickness = 20,
    skipBoundaries = [],
  } = options;
  const output = EntityList();
  const halfThickness = thickness / 2;
  if (!skipBoundaries.includes("right"))
    output.addChild(
      Entity({
        x: width / 2 + halfThickness,
        y: 0,
        height: height + thickness,
        width: thickness,
        noRender: false,
        matter: { shape: "rectangle", static: true },
        boundaryType: "right",
      }),
    );
  if (!skipBoundaries.includes("left"))
    output.addChild(
      Entity({
        x: width / -2 - halfThickness,
        y: 0,
        height: height + thickness,
        width: thickness,
        noRender: false,
        matter: { shape: "rectangle", static: true },
        boundaryType: "left",
      }),
    );
  if (!skipBoundaries.includes("top") && !skipBoundaries.includes("up"))
    output.addChild(
      Entity({
        x: 0,
        y: height / -2 - halfThickness,
        height: thickness,
        width: width + thickness,
        noRender: false,
        matter: { shape: "rectangle", static: true },
        boundaryType: "top",
      }),
    );
  if (!skipBoundaries.includes("bottom") && !skipBoundaries.includes("down"))
    output.addChild(
      Entity({
        x: 0,
        y: 50 + halfThickness,
        height: thickness,
        width: width + thickness,
        noRender: false,
        matter: { shape: "rectangle", static: true },
        boundaryType: "bottom",
      }),
    );
  return output;
}

const minimumUpdateThreshold = 0.0001;

export default function matterPlugin(entities, settings = {}) {
  if (!isStore(settings)) settings = Store(settings);
  entities = entities.deepFlat;
  const engineSignal = Signal(null);
  let matterEntities = [];
  let collisionEventQueue = [];
  let isDoingPhysicsUpdate = false;
  let matterRenderer = null;
  let isMounted = false;

  const entityListener = (newEntityList, oldEntityList) => {
    const removedEntities = oldEntityList.filter(
      (entity) => !newEntityList.includes(entity),
    );
    const newEntities = newEntityList.filter(
      (entity) => !oldEntityList.includes(entity),
    );
    newEntities.forEach((entity) => mountEntity(entity));
    removedEntities.forEach((entity) => unmountEntity(entity));
  };

  const syncMatterVisibility = (entity) => {
    if (!entity || !entity.matterBody) return;
    const visible = !entity.noRender && !entity.noMatterRender;
    const bodies = Array.isArray(entity.matterBody)
      ? entity.matterBody
      : [entity.matterBody];
    for (const body of bodies) {
      if (body && body.render) body.render.visible = visible;
    }
  };

  const mountEntity = (entity, engine = null) => {
    if (engine === null) engine = engineSignal.get();
    if (typeof entity?.matter !== "object" || entity.matter === null) return; // Don't mount things that aren't intended to have physics
    let matterBody;
    const matterOptions = { ...entity.matter };
    delete matterOptions.predefined;
    delete matterOptions.shape;
    delete matterOptions.static;
    delete matterOptions.inertia;
    if (
      typeof entity.matter.predefined == "object" &&
      entity.matter.predefined !== null
    ) {
      matterBody = entity.matter.predefined;
    } else {
      if (
        typeof entity.matter?.shape != "string" ||
        !(entity.matter.shape in Bodies)
      )
        throw new Error("Expected a valid matter shape property");
      const { shape, sides } = entity.matter;
      const radius = Math.max(entity.width, entity.height) / 2;
      if (shape === "rectangle") {
        //        console.log("init", entity.x, entity.y);
        matterBody = Bodies.rectangle(
          entity.x,
          entity.y,
          entity.width,
          entity.height,
          matterOptions,
        );
      } else if (shape === "circle") {
        matterBody = Bodies.circle(entity.x, entity.y, radius, matterOptions); //        console.log("postinit", matterBody.position);
      } else if (shape === "polygon") {
        if (!isFinite(sides) || sides === null)
          throw new Error("Invalid Sides Value");
        matterBody = Bodies.polygon(
          entity.x,
          entity.y,
          sides,
          radius,
          matterOptions,
        );
      } else {
        throw new Error("Unimplemented Shape: " + shape);
      }
    }
    entity.collisions = [];
    const { static: isStatic, inertia, restitution } = entity.matter;
    if (typeof isStatic == "boolean")
      Matter.Body.setStatic(matterBody, isStatic);
    if (isFinite(inertia) && inertia !== null)
      Body.setInertia(matterBody, inertia);
    if (isFinite(restitution) && restitution !== null)
      matterBody.restitution = restitution;
    entity.matterBody = matterBody;
    if (!matterEntities.includes(entity)) matterEntities.push(entity);
    entity.matterListeners = {
      position: () => {
        if (isDoingPhysicsUpdate) return;
        // console.log(
        //   `Position listener triggered for entity at (${entity.x}, ${entity.y})`,
        // );
        // const translatedX = translateToNewOrigin(entity.x, 0, entity.width / 2);
        // const translatedY = translateToNewOrigin(
        //   entity.y,
        //   0,
        //   entity.height / 2,
        // );
        if (
          Math.abs(entity.matterBody.position.x - entity.x) >
            minimumUpdateThreshold ||
          Math.abs(entity.matterBody.position.y - entity.y) >
            minimumUpdateThreshold
        ) {
          // Position is mismatched
          Matter.Body.setPosition(entity.matterBody, {
            x: entity.x,
            y: entity.y,
          });
        }
      },
      static: () => {
        Matter.Body.setStatic(entity.matterBody, entity.static);
      },
      visibility: () => {
        syncMatterVisibility(entity);
      },
    };
    entity.on("x", entity.matterListeners.position);
    entity.on("y", entity.matterListeners.position);
    entity.on("static", entity.matterListeners.static);
    entity.on("noRender", entity.matterListeners.visibility);
    entity.on("noMatterRender", entity.matterListeners.visibility);
    syncMatterVisibility(entity);
    //console.log("adding", engine.world, entity.matterBody);
    Composite.add(engine.world, entity.matterBody);
  };

  const unmountEntity = (entity) => {
    //console.log("unmounting", entity, entity.matterBody);
    if (!entity || !entity.matterBody) return; // is not a matter entity
    if (entity.matterListeners) {
      entity.off("x", entity.matterListeners.position);
      entity.off("y", entity.matterListeners.position);
      entity.off("static", entity.matterListeners.static);
      entity.off("noRender", entity.matterListeners.visibility);
      entity.off("noMatterRender", entity.matterListeners.visibility);
    }
    entity.matterListeners = [];
    //console.log("attempting remove composite");
    Composite.remove(engineSignal.get().world, entity.matterBody);
    //console.log("entities length before removal", matterEntities.length);
    entity.matterBody = null;
    matterEntities = matterEntities.filter(
      (compareEntity) => compareEntity !== entity,
    );
    entity.collisions = null;
    //console.log("entities length after removal", matterEntities.length);
  };

  const getEntityFromBody = (body) =>
    matterEntities.find(
      (entity) =>
        entity.matterBody === body ||
        entity?.matter?.predefined?.includes(body),
    ) || null;

  // ---------------------------------------------------------------------------
  // Matter debug renderer lifecycle
  // ---------------------------------------------------------------------------

  const getCanvasPixelWidth = () =>
    Number.isFinite(settings.width)
      ? settings.width
      : settings.canvas?.width || 100;

  const getCanvasPixelHeight = () =>
    Number.isFinite(settings.height)
      ? settings.height
      : settings.canvas?.height || 100;

  const destroyMatterRenderer = () => {
    if (!matterRenderer) return;
    Render.stop(matterRenderer);
    matterRenderer.canvas = null;
    matterRenderer.context = null;
    matterRenderer.textures = {};
    matterRenderer = null;
  };

  const createMatterRenderer = () => {
    const engine = engineSignal.get();
    const canvas = settings.canvas;

    destroyMatterRenderer();
    if (!engine || !canvas) return;

    const renderOptions =
      typeof settings.renderOptions === "object" &&
      settings.renderOptions !== null
        ? settings.renderOptions
        : {};

    const transparent = settings.transparentBackground === true;
    const pixelWidth = getCanvasPixelWidth();
    const pixelHeight = getCanvasPixelHeight();

    matterRenderer = Render.create({
      canvas,
      engine,
      options: {
        width: pixelWidth,
        height: pixelHeight,

        // Without hasBounds, Render.world overwrites render.bounds from
        // all bodies every frame and ignores our world viewport.
        hasBounds: true,

        // Retina / HiDPI displays otherwise multiply the canvas backing
        // store by devicePixelRatio² (e.g. 1080² -> 2160² = 4x pixels).
        // For a debug overlay, that's pure waste. Force 1:1 pixels.
        pixelRatio: 1,

        ...(transparent
          ? {
              background: "transparent",
              wireframeBackground: "transparent",
            }
          : {}),

        ...renderOptions,
      },
    });

    // World viewport: -50..+50 in both axes, matching the engine's
    // virtual coordinate system directly.
    matterRenderer.bounds.min.x = -50;
    matterRenderer.bounds.min.y = -50;
    matterRenderer.bounds.max.x = 50;
    matterRenderer.bounds.max.y = 50;

    if (transparent) matterRenderer.canvas.style.background = "transparent";
  };

  const resizeMatterRenderer = () => {
    if (!matterRenderer) return;
    const pixelWidth = getCanvasPixelWidth();
    const pixelHeight = getCanvasPixelHeight();
    if (!Number.isFinite(pixelWidth) || !Number.isFinite(pixelHeight)) return;
    if (
      matterRenderer.options.width === pixelWidth &&
      matterRenderer.options.height === pixelHeight
    )
      return;

    matterRenderer.options.width = pixelWidth;
    matterRenderer.options.height = pixelHeight;
    // Keep the backing store at 1:1 pixel ratio (see pixelRatio above).
    matterRenderer.canvas.width = pixelWidth;
    matterRenderer.canvas.height = pixelHeight;
  };

  // React to canvas swaps and size changes on the settings store.
  const handleCanvasChange = () => {
    if (!isMounted) return;
    createMatterRenderer();
  };

  const handleSizeChange = () => {
    if (!isMounted) return;
    if (!settings.canvas) return;
    if (!matterRenderer) {
      createMatterRenderer();
      return;
    }
    resizeMatterRenderer();
  };

  const mount = async () => {
    const engine = Engine.create();
    if (typeof settings.setup == "function") {
      await settings.setup(engine, entities, Matter);
    }
    Events.on(engine, "collisionStart", (collisionEvent) => {
      const collisions = collisionEvent.source.pairs.list;
      collisions.forEach((collision) => {
        const { bodyA, bodyB } = collision;
        const entityA = getEntityFromBody(bodyA);
        const entityB = getEntityFromBody(bodyB);
        const collisionDataA = {
          myBody: bodyA,
          colliderBody: bodyB,
          bodyA,
          bodyB,
          myEntity: entityA,
          colliderEntity: entityB,
          eventData: collision,
          myBodyLetter: "A",
          colliderBodyLetter: "B",
        };
        const collisionDataB = {
          myBody: bodyB,
          colliderBody: bodyA,
          bodyA,
          bodyB,
          myEntity: entityB,
          colliderEntity: entityA,
          eventData: collision,
          myBodyLetter: "B",
          colliderBodyLetter: "A",
        };
        collisionEventQueue.push(() => {
          if (!entityA) {
            console.warn("Unable to locate entityA");
          } else {
            if (entityA.collisions)
              entityA.collisions = entityA.collisions.concat([collisionDataA]);

            if (typeof entityA?.onCollision == "function")
              entityA.onCollision(collisionDataA);
          }
          if (!entityB) {
            console.warn("Unable to locate entityB");
          } else {
            if (entityB.collisions)
              entityB.collisions = entityB.collisions.concat([collisionDataB]);

            if (typeof entityB?.onCollision == "function")
              entityB.onCollision(collisionDataB);
          }
        });
      });
    });

    Events.on(engine, "collisionEnd", (collisionEvent) => {
      const collisions = collisionEvent.pairs;
      collisions.forEach((collision) => {
        const { bodyA, bodyB } = collision;
        const entityA = getEntityFromBody(bodyA);
        const entityB = getEntityFromBody(bodyB);
        const collisionDataA = {
          myBody: bodyA,
          colliderBody: bodyB,
          bodyA,
          bodyB,
          myEntity: entityA,
          colliderEntity: entityB,
          eventData: collision,
          myBodyLetter: "A",
          colliderBodyLetter: "B",
        };
        const collisionDataB = {
          myBody: bodyB,
          colliderBody: bodyA,
          bodyA,
          bodyB,
          myEntity: entityB,
          colliderEntity: entityA,
          eventData: collision,
          myBodyLetter: "B",
          colliderBodyLetter: "A",
        };
        collisionEventQueue.push(() => {
          if (!entityA) {
            console.warn("Unable to locate entityA");
          } else {
            if (entityA.collisions)
              entityA.collisions = entityA.collisions.filter(
                (collisionData) => collisionData.eventData.id !== collision.id,
              );

            if (typeof entityA?.onCollisionEnd == "function")
              entityA.onCollisionEnd(collisionDataA);
          }
          if (!entityB) {
            console.warn("Unable to locate entityB");
          } else {
            if (entityB.collisions)
              entityB.collisions = entityB.collisions.filter(
                (collisionData) => collisionData.eventData.id !== collision.id,
              );

            if (typeof entityB?.onCollisionEnd == "function")
              entityB.onCollisionEnd(collisionDataB);
          }
        });
      });
    });
    engineSignal.set(engine);

    if (settings.canvas) createMatterRenderer();

    isMounted = true;

    settings.on("canvas", handleCanvasChange);
    settings.on("width", handleSizeChange);
    settings.on("height", handleSizeChange);

    entities.get().forEach((entity) => mountEntity(entity, engine));
    entities.addListener(entityListener);
    window.matterEntities = matterEntities;
  };

  const updateEntityFromMatter = (entity, matterBody) => {
    //if (matterBody.isStatic) return; // Don't update entities with static matter bodies as they will never change
    const { x, y } = matterBody.position;
    const translatedX = x; //translateToNewOrigin(x, entity.width / 2, 0);
    const translatedY = y; //translateToNewOrigin(y, entity.height / 2, 0);
    if (Math.abs(entity.x - translatedX) > minimumUpdateThreshold) {
      // Position is mismatched
      entity.x = translatedX;
    }
    if (Math.abs(entity.y - translatedY) > minimumUpdateThreshold) {
      entity.y = translatedY;
    }
    if (
      !isFinite(entity.rotation) ||
      Math.abs(entity.rotation - matterBody.angle) > minimumUpdateThreshold
    ) {
      entity.rotation = matterBody.angle;
    }
  };

  const tick = ({ delta }) => {
    isDoingPhysicsUpdate = true;
    Engine.update(engineSignal.get(), Math.min(delta, 50)); // Safety Mechanism
    matterEntities.forEach((entity) => {
      if (Array.isArray(entity.matterBody)) {
        entity.matterBody.forEach((body) => {
          updateEntityFromMatter(entity, body);
        });
      } else if (
        entity.matterBody === null ||
        entity.matterBody === undefined
      ) {
        // Do Nothing
        console.warn("Found missing matter body");
      } else {
        updateEntityFromMatter(entity, entity.matterBody);
      }
    });
    isDoingPhysicsUpdate = false;
    collisionEventQueue.forEach((queuedEvent) => queuedEvent()); // Delay the collision notifications until the physics has finished running
    collisionEventQueue = [];
  };

  const render = () => {
    if (!matterRenderer) return;

    // In transparent mode, explicitly clear the canvas before Matter draws
    // so previous frames don't accumulate. Identity transform is restored
    // afterward so Matter's own view transform still works.
    if (settings.transparentBackground === true) {
      const ctx = matterRenderer.context;
      const canvas = matterRenderer.canvas;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    Render.world(matterRenderer);
  };

  const unmount = () => {
    settings.off("canvas", handleCanvasChange);
    settings.off("width", handleSizeChange);
    settings.off("height", handleSizeChange);

    destroyMatterRenderer();

    matterEntities.forEach(unmountEntity);
    matterEntities = [];
    isMounted = false;
  };

  const useMatterPlugin = (plugin) => {
    Matter.use(plugin);
  };

  return {
    tick,
    mount,
    unmount,
    render,
    engineSignal,
    Matter,
    useMatterPlugin,
    settings,
  };
}

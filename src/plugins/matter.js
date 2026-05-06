import Matter from "matter-js";
const { Engine, Bodies, Composite, Body, Events } = Matter;
import { Signal } from "jabr";
import { translateToNewOrigin } from "lilis-engine/utility";

const minimumUpdateThreshold = 0.0001;

export default function matterPlugin(entities) {
  const engineSignal = Signal(null);
  let matterEntities = [];
  let collisionEventQueue = [];
  let isDoingPhysicsUpdate = false;
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
  const mountEntity = (entity, engine = null) => {
    if (engine === null) engine = engineSignal.get();
    if (typeof entity?.matter !== "object" || entity.matter === null) return; // Don't mount things that aren't intended to have physics
    let matterBody;
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
      const { shape } = entity.matter;
      if (shape === "rectangle") {
        //        console.log("init", entity.x, entity.y);
        matterBody = Bodies.rectangle(
          entity.x,
          entity.y,
          entity.width,
          entity.height,
        );
      } else if (shape === "circle") {
        matterBody = Bodies.circle(entity.x, entity.y, entity.width / 2); //        console.log("postinit", matterBody.position);
      } else {
        throw new Error("Unimplemented Shape: " + shape);
      }
    }
    entity.collisions = new Signal([]);
    const { static: isStatic } = entity.matter;
    if (typeof isStatic == "boolean")
      Matter.Body.setStatic(matterBody, isStatic);
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
    };
    entity.on("x", entity.matterListeners.position);
    entity.on("y", entity.matterListeners.position);
    //console.log("adding", engine.world, entity.matterBody);
    Composite.add(engine.world, entity.matterBody);
  };
  const unmountEntity = (entity) => {
    //console.log("unmounting", entity, entity.matterBody);
    if (!entity || !entity.matterBody) return; // is not a matter entity
    if (entity.matterListeners) {
      entity.off("x", entity.matterListeners.position);
      entity.off("y", entity.matterListeners.position);
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
  const mount = () => {
    const engine = Engine.create();
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
              entityA.collisions.set(
                entityA.collisions.get().concat([collisionDataA]),
              );

            if (typeof entityA?.onCollision == "function")
              entityA.onCollision(collisionDataA);
          }
          if (!entityB) {
            console.warn("Unable to locate entityB");
          } else {
            if (entityB.collisions)
              entityB.collisions.set(
                entityB.collisions.get().concat([collisionDataB]),
              );

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
              entityA.collisions.set(
                entityA.collisions
                  .get()
                  .filter(
                    (collisionData) =>
                      collisionData.eventData.id !== collision.id,
                  ),
              );

            if (typeof entityA?.onCollisionEnd == "function")
              entityA.onCollisionEnd(collisionDataA);
          }
          if (!entityB) {
            console.warn("Unable to locate entityB");
          } else {
            if (entityB.collisions)
              entityB.collisions.set(
                entityB.collisions
                  .get()
                  .filter(
                    (collisionData) =>
                      collisionData.eventData.id !== collision.id,
                  ),
              );

            if (typeof entityB?.onCollisionEnd == "function")
              entityB.onCollisionEnd(collisionDataB);
          }
        });
      });
    });
    engineSignal.set(engine);
    entities.get().forEach((entity) => mountEntity(entity, engine));
    entities.addListener(entityListener);
    window.matterEntities = matterEntities;
  };
  const updateEntityFromMatter = (entity, matterBody) => {
    if (matterBody.isStatic) return; // Don't update entities with static matter bodies as they will never change
    const { x, y } = matterBody.position;
    const translatedX = translateToNewOrigin(x, entity.width / 2, 0);
    const translatedY = translateToNewOrigin(y, entity.height / 2, 0);
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
  const unmount = () => {
    matterEntities.forEach(unmountEntity);
    matterEntities = [];
  };
  return { tick, mount, unmount, engineSignal };
}

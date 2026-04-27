import Matter from "matter-js";
const { Engine, Bodies, Composite } = Matter;
import { Signal } from "jabr";
import translateToNewOrigin from "../utility/translateToNewOrigin.js";

const minimumUpdateThreshold = 0.0001;

export default function matterPlugin(entities) {
  const engineSignal = Signal(null);
  let matterEntities = [];
  let isDoingPhysicsUpdate = false;
  const mountEntity = (entity, engine) => {
    if (typeof entity.matter !== "object" || entity.matter === null) return; // Don't mount things that aren't intended to have physics
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
          translateToNewOrigin(entity.x, 0, entity.width / 2),
          translateToNewOrigin(entity.y, 0, entity.height / 2),
          entity.width,
          entity.height,
        );
        //        console.log("postinit", matterBody.position);
      } else {
        throw new Error("Unimplemented Shape: " + shape);
      }
    }
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
    console.log("adding", engine.world, entity.matterBody);
    Composite.add(engine.world, entity.matterBody);
  };
  const unmountEntity = (entity) => {
    if (entity.matterListeners) {
      entity.off("x", entity.matterListeners.position);
      entity.off("y", entity.matterListeners.position);
    }
    delete entity.matterBody;
    delete entity.matterListeners;
  };
  const mount = () => {
    const engine = Engine.create();
    engineSignal.set(engine);
    entities.get().forEach((entity) => mountEntity(entity, engine));
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
    //console.log(matterEntities[0].matterBody.position);
    //console.log(delta);
    Engine.update(engineSignal.get(), Math.min(delta, 50)); // Safety Mechanism
    matterEntities.forEach((entity) => {
      if (Array.isArray(entity.matterBody)) {
        entity.matterBody.forEach((body) => {
          updateEntityFromMatter(entity, body);
        });
      } else {
        updateEntityFromMatter(entity, entity.matterBody);
      }
    });
    isDoingPhysicsUpdate = false;
  };
  const unmount = () => {
    matterEntities.forEach(unmountEntity);
    matterEntities = [];
  };
  return { tick, mount, unmount, engineSignal };
}

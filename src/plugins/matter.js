import Matter from "matter-js";
const { Engine, Bodies, Composite } = Matter;
import { Signal } from "jabr";

export default function matterPlugin(entities) {
  const engineSignal = Signal(null);
  let matterEntities = [];
  let isDoingPhysicsUpdate = false;
  const mountEntity = (entity, engine) => {
    console.log(entity, "Engine Register", entity.matter);
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
          entity.x,
          entity.y,
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
        console.log(
          `Position listener triggered for entity at (${entity.x}, ${entity.y})`,
        );
        if (
          entity.x !== entity.matterBody.position.x ||
          entity.y !== entity.matterBody.position.y
        ) {
          // Position is mismatched
          Matter.Body.position(entity.matterBody, { x: entity.x, y: entity.y });
        }
      },
    };
    entity.on("x", entity.matterListeners.position);
    entity.on("y", entity.matterListeners.position);
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
  };
  const tick = ({ delta }) => {
    isDoingPhysicsUpdate = true;
    //console.log(matterEntities[0].matterBody.position);
    console.log(delta);
    Engine.update(engineSignal.get(), Math.min(delta, 50)); // Safety Mechanism
    matterEntities.forEach((entity) => {
      const { x, y } = entity.matterBody.position;
      if (entity.x !== x) entity.x = x;
      if (entity.y !== y) entity.y = y;
    });
    isDoingPhysicsUpdate = false;
  };
  const unmount = () => {
    matterEntities.forEach(unmountEntity);
    matterEntities = [];
  };
  return { tick, mount, unmount, engineSignal };
}

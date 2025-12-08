import { Engine, Runner, Bodies, Composite } from "matter-js";

export default function createMatterPhysics(entities, physicsSettings) {
  let engine;
  let world;
  let physicsBodies;
  const addPhysicsEntity = (entity) => {
    const physicsBody = Bodies.rectangle(
      entity.x,
      entity.y,
      entity.width,
      entity.height
    );
    entity.physicsBody = physicsBody;
    Composite.add(world, physicsBody);
    physicsBodies.set(entity, physicsBody);
  };
  const removePhysicsEntity = (entity) => {
    if (!physicsBodies.has(entity))
      return console.warn("Could not find physics body to remove");
    const physicsBody = physicsBodies.get(entity);
    Composite.remove(world, physicsBody);
    delete entity.physicsBody;
  };
  const entityListener = (currentEntities, oldEntities) => {
    const newEntities = currentEntities.filter(
      (entity) => !oldEntities.includes(entity)
    );
    newEntities.forEach(addPhysicsEntity);
    const destroyedEntities = oldEntities.filter(
      (entity) => !currentEntities.includes(entity)
    );
    destroyedEntities.forEach(destroyEntity);
  };
  const mount = () => {
    physicsBodies = new WeakMap();
    engine = Matter.Engine.create();
    world = engine.world;
    entities.get().forEach(addPhysicsEntity);
    entities.addListener(entityListener);
  };
  const unmount = () => {
    entities.get().forEach(removePhysicsEntity);
  };
  return { mount, unmount, tick };
}

import { Store, convertFunctionToConstructor } from "jabr";
import Entity from "./formats/Entity.js";

function createEntity(state = {}) {
  const defaultEntity = {
    x: 0,
    y: 0,
    z: 0,
    width: 100,
    height: 100,
    depth: 100,
  };
  return new Store(
    { ...defaultEntity, ...state },
    {
      format: Entity,
    },
  );
}

export default convertFunctionToConstructor(createEntity);

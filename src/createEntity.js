import { Store, convertFunctionToConstructor } from "jabr";
import Entity from "./formats/Entity.js";

function createEntity(state) {
  return new Store(
    state || {} /*, {
    format: Entity,
  }*/,
  );
}

export default convertFunctionToConstructor(createEntity);

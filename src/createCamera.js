import { Store, convertFunctionToConstructor } from "jabr";
import Entity from "./formats/Entity.js";

function createCamera(state) {
  return new Store(state || {}, {});
}

export default convertFunctionToConstructor(createCamera);

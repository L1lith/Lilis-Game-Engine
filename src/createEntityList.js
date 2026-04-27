import { convertFunctionToConstructor } from "jabr";
import { Signal } from "jabr";
import InnerEntityListFormat from "./formats/InnerEntityList.js";

function createEntityList(initialList = []) {
  return new Signal(initialList /*, InnerEntityListFormat*/);
}

export default convertFunctionToConstructor(createEntityList);

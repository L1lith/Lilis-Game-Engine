import { Signal } from "jabr";
import InnerEntityListFormat from "./formats/InnerEntityList.js";

export default function createEntityList(initialList = []) {
  return new Signal(initialList, InnerEntityListFormat);
}

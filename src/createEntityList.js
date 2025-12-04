import { Signal } from "jabr";
import InnerEntityListFormat from "./formats/InnerEntityList";

export default function createEntityList(initialList = []) {
  return new Signal(initialList, InnerEntityListFormat);
}

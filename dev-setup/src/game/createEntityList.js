import { Signal } from "jabr";
import { ANY, details } from "sandhands";
import InnerEntityListFormat from "./formats/InnerEntityList";

export default function createEntityList(initialList = []) {
  return new Signal(initialList, InnerEntityListFormat);
}

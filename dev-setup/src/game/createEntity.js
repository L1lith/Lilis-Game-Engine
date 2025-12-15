import { Store } from "jabr";
import Entity from "./formats/Entity";

export default function createEntity(state) {
  return new Store(state || {}, {
    format: Entity,
  });
}

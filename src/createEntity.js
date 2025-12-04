import { Store } from "Jabr";
import Entity from "./formats/Entity";

export default function createEntity(state) {
  return new Store(state || {}, {
    format: Entity,
  });
}

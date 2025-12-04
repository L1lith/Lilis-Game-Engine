import Entity from "./Entity";
import { isSignal } from "jabr";
import InnerEntityList from "./InnerEntityList";
import { valid } from "sandhands";

export default {
  _: Object,
  validate: (entityList) =>
    isSignal(entityList) && valid(entityList.get(), InnerEntityList),
};

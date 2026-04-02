import Entity from "./Entity.js";
import { isSignal } from "jabr";
import InnerEntityList from "./InnerEntityList.js";
import { valid } from "sandhands";

export default {
  _: Object,
  validate: (entityList) =>
    isSignal(entityList) && valid(entityList.get(), InnerEntityList),
};

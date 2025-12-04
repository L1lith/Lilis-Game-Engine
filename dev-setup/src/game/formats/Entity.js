import { isStore } from "jabr";

export default {
  _: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  strict: false,
  validate: (entity) => isStore(entity),
};

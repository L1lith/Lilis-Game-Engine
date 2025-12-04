import { isStore } from "jabr";
import { ANY } from "sandhands";

export default {
  _: {
    canvas: {
      _: ANY,
      strict: false,
      validate: (el) => el === null || el instanceof HTMLCanvasElement,
    },
  },
  strict: false,
};

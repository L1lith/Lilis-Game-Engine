import { isStore } from "jabr";
import InnerRenderSettingsFormat from "./InnerRenderSettings.js";
import { valid } from "sandhands";

export default {
  _: Object,
  validate: (renderSettings) =>
    isStore(renderSettings) && valid(renderSettings, InnerRenderSettingsFormat),
};

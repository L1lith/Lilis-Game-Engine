import { convertFunctionToConstructor } from "jabr";
import InnerRenderSettingsFormat from "./formats/InnerRenderSettings.js";
import { valid } from "sandhands";
import { Store } from "jabr";

const defaultSettings = {};

function createRenderSettings(initialSettings = {}) {
  const settings = { ...defaultSettings, ...initialSettings };
  if (!valid(settings, InnerRenderSettingsFormat))
    throw new Error("Invalid Initial Render Settings");
  return new Store(settings, { format: InnerRenderSettingsFormat });
}

export default convertFunctionToConstructor(createRenderSettings);

import InnerRenderSettingsFormat from "./formats/InnerRenderSettings";
import { valid } from "sandhands";
import { Store } from "jabr";

const defaultSettings = {
  canvas: null,
};

export default function createRenderSettings(initialSettings = {}) {
  const settings = { ...defaultSettings, ...initialSettings };
  if (!valid(settings, InnerRenderSettingsFormat))
    throw new Error("Invalid Initial Render Settings");
  return new Store(settings, { format: InnerRenderSettingsFormat });
}

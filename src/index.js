import { convertFunctionToConstructor } from "jabr";
import createPixiRenderer from "./createPixiRenderer.js";
import createGameCore from "./createGameCore.js";
import createGameLoop from "./createGameLoop.js";
import createEntityList from "./createEntityList.js";
import createRenderSettings from "./createRenderSettings.js";
import createEntity from "./createEntity.js";

export const PixiRenderer = convertFunctionToConstructor(createPixiRenderer);
export const GameLoop = convertFunctionToConstructor(createGameLoop);
export const GameCore = convertFunctionToConstructor(createGameCore);
export const Entity = convertFunctionToConstructor(createEntity);
export const EntityList = convertFunctionToConstructor(createEntityList);
export const RenderSettings =
  convertFunctionToConstructor(createRenderSettings);

import { convertFunctionToConstructor } from "jabr";
import createPixiRenderer from "./createPixiRenderer";
import createGameCore from "./createGameCore";
import createGameLoop from "./createGameLoop";
import createEntityList from "./createEntityList";
import createRenderSettings from "./createRenderSettings";
import createEntity from "./createEntity";

export const PixiRenderer = convertFunctionToConstructor(createPixiRenderer);
export const GameLoop = convertFunctionToConstructor(createGameLoop);
export const GameCore = convertFunctionToConstructor(createGameCore);
export const Entity = convertFunctionToConstructor(createEntity);
export const EntityList = convertFunctionToConstructor(createEntityList);
export const RenderSettings =
  convertFunctionToConstructor(createRenderSettings);

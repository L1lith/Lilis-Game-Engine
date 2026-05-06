import { Signal, convertFunctionToConstructor } from "jabr";
import EntityList from "./createEntityList.js";

async function createLevelLoader(entityList, levels, defaultLevel = null) {
  const resolveLevel = (nameOrLevel) => {
    if (typeof nameOrLevel === "string") {
      if (!(nameOrLevel in levels)) throw new Error("Unrecognized Level Name");
      if (
        typeof levels[nameOrLevel] != "object" ||
        levels[nameOrLevel] === null
      )
        throw new Error(`Level "${nameOrLevel}" isn't an object`);
      levels[nameOrLevel].name = nameOrLevel;
      return levels[nameOrLevel];
    } else if (typeof nameOrLevel === "object" && nameOrLevel !== null) {
      return nameOrLevel;
    } else {
      throw new Error("Invalid Level Supplied");
    }
  };
  //if (defaultLevel !== null) resolveLevel(defaultLevel); // Ensure the default level is valid
  let mountedLevels = [];
  const activeLevel = new Signal(null);
  const activeLevelEntities = new EntityList([]);
  const entityListener = (newEntityList, oldEntityList) => {
    const removedEntities = oldEntityList.filter(
      (entity) => !newEntityList.includes(entity),
    );
    const newEntities = newEntityList.filter(
      (entity) => !oldEntityList.includes(entity),
    );
    const updatedEntityList = entityList
      .get()
      .filter((entity) => !removedEntities.includes(entity))
      .concat(
        newEntities.filter((entity) => !entityList.get().includes(entity)),
      );
    entityList.set(updatedEntityList);
  };
  const loadLevel = async (nameOrLevel) => {
    console.log("Loading Level:", nameOrLevel);
    await unloadLevel();
    const level = resolveLevel(nameOrLevel);
    await mountLevel(level);
    activeLevel.set(level);
    if (typeof level.load == "function") {
      await level.load(level, loadLevel);
    }
    level.entityList.addListener(entityListener);
    entityListener(level.entityList.get(), []);
  };
  const unloadLevel = async () => {
    const level = activeLevel.get();
    if (level === null) return; // No level is currently loaded
    if (typeof activeLevel.unload == "function")
      await activeLevel.unload(level, loadLevel);
    activeLevel.set(null);
    level.entityList.removeListener(entityListener);
    entityListener([], level.entityList.get());
  };
  const mountLevel = async (level) => {
    level = resolveLevel(level);
    if (mountedLevels.includes(level)) return;
    level.entityList =
      typeof level.defaultEntities == "object" && level.defaultEntities !== null
        ? level.defaultEntities
        : new EntityList();
    if (typeof level.mount == "function") {
      level.exports = (await level.mount(level, loadLevel)) || null;
    }
    mountedLevels = mountedLevels.concat([level]);
    level.isMounted = true;
  };
  const unmountLevel = async (level) => {
    level = resolveLevel(level);
    if (!mountedLevels.includes(level)) return;
    if (typeof level.unmount == "function") {
      await level.unmount(level, loadLevel);
      level.exports = null;
    }
    mountedLevels = mountedLevels.filter((matchLevel) => matchLevel !== level);
    level.isMounted = false;
  };
  if (defaultLevel !== null) await loadLevel(defaultLevel);
  const mount = async () => {};
  const unmount = async () => {
    await unloadLevel();
    await Promise.all(mountedLevels.map((level) => unmountLevel(level)));
  };
  const tick = async () => {
    const level = activeLevel.get();
    if (level && typeof level.tick == "function")
      await level.tick(level, loadLevel);
  };
  return {
    mount,
    unmount,
    tick,
    preloadLevel: mountLevel,
    loadLevel,
    unloadLevel,
    activeLevel,
  };
}

export default convertFunctionToConstructor(createLevelLoader);

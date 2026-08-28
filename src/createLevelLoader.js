import { Signal, convertFunctionToConstructor, Store } from "jabr";
import { EntityList } from "lilis-engine";

function createLevelLoader(entityList, levels, options = {}) {
  const {
    defaultLevel = null,
    globalContext: globalContextInput,
    player = null,
  } = options;
  const globalContext =
    typeof globalContextInput == "object" && globalContextInput !== null
      ? globalContextInput
      : {};
  const resolveLevel = (nameOrLevel) => {
    if (typeof nameOrLevel === "string") {
      if (!(nameOrLevel in levels))
        throw new Error("Unrecognized Level Name: " + nameOrLevel);
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
  let mountedLevels = [];
  const activeLevel = new Signal(null);
  const loadLevel = async (nameOrLevel) => {
    let coords = null;
    if (typeof nameOrLevel == "string" && nameOrLevel.includes("@")) {
      const [newName, rawCoords] = nameOrLevel.split("@");
      nameOrLevel = newName;
      coords = rawCoords.split(",").map((value) => parseFloat(value));
    }
    await unloadLevel();
    const level = resolveLevel(nameOrLevel);
    await mountLevel(level);
    activeLevel.set(level);
    if (coords !== null && player !== null) {
      player.x = coords[0];
      player.y = coords[1];
    }
    if (typeof level.load == "function") {
      await level.load(globalContext, level);
    }
    entityList.addChild(level.entityList);
  };
  globalContext.load = loadLevel;
  const unloadLevel = async () => {
    const level = activeLevel.get();
    if (level === null) return; // No level is currently loaded
    if (typeof activeLevel.unload == "function")
      await activeLevel.unload(globalContext, level);
    activeLevel.set(null);
    entityList.removeChild(level.entityList);
  };
  const mountLevel = async (level) => {
    level = resolveLevel(level);
    if (mountedLevels.includes(level)) return;
    level.entityList =
      typeof level.defaultEntities == "object" && level.defaultEntities !== null
        ? level.defaultEntities
        : new EntityList();
    level.exports = new Store();
    if (typeof level.mount == "function") {
      const mountOutput = await level.mount(globalContext, level);
      if (typeof mountOutput == "object" && mountOutput !== null) {
        Object.keys(mountOutput).forEach((key) => {
          console.log("assigning", typeof key, key, mountOutput[key]);
          level.exports[key] = mountOutput[key];
        });
      }
    }
    mountedLevels = mountedLevels.concat([level]);
    level.isMounted = true;
  };
  globalContext.preload = mountLevel;
  const unmountLevel = async (level) => {
    level = resolveLevel(level);
    if (!mountedLevels.includes(level)) return;
    if (typeof level.unmount == "function") {
      await level.unmount(globalContext, level);
      level.exports = null;
    }
    mountedLevels = mountedLevels.filter((matchLevel) => matchLevel !== level);
    level.isMounted = false;
  };
  const mount = async () => {
    if (defaultLevel !== null) await loadLevel(defaultLevel);
  };
  const unmount = async () => {
    await unloadLevel();
    await Promise.all(mountedLevels.map((level) => unmountLevel(level)));
  };
  const tick = async (...args) => {
    const level = activeLevel.get();
    if (level && typeof level.tick == "function")
      await level.tick(globalContext, level, ...args);
  };
  return {
    mount,
    unmount,
    tick,
    preloadLevel: mountLevel,
    loadLevel,
    unloadLevel,
    activeLevel,
    globalContext,
  };
}

export default convertFunctionToConstructor(createLevelLoader);

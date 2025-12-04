import { Store } from "jabr";
import Emitter from "tiny-emitter";

const defaultData = {
  plugins: [],
};

export default function createGameCore(initialData = null) {
  if (initialData !== null && typeof initialData != "object")
    throw new Error("Invalid Initial Data");
  let gameCore;
  const gameStore = new Store(
    initialData === null
      ? defaultData
      : { ...defaultData, ...initialData, mounted: false },
    {
      format: {
        _: {
          plugins: { _: [Object], minLength: 0 },
          mounted: Boolean,
        },
        strict: false,
      },
    }
  );
  const emitter = new Emitter();
  const gameMethods = {
    mount: async () => {
      try {
        await Promise.all(
          gameStore.plugins.map(async (plugin) => await plugin?.mount(gameCore))
        );
      } catch (error) {
        try {
          // Unmount all the plugins if any of them fail
          await Promise.all(
            gameStore.plugins.map(
              async (plugin) => await plugin?.unmount(gameCore)
            )
          );
        } catch (e) {
          console.warn("Failed to unmount after failed mount");
        }
        throw error;
      }
      gameStore.mounted = true;
      return true;
    },
    unmount: async () => {
      await Promise.all(
        gameStore.plugins.map(async (plugin) => await plugin?.unmount(gameCore))
      );
      return true;
    },
    getPlugins(type = null) {
      if (typeof type == "string") {
        return gameStore.plugins.filter((plugin) =>
          plugin.types.includes(type)
        );
      }
      return gameStore.plugins;
    },
  };
  return (gameCore = new Proxy(gameStore, {
    get: (target, prop) => {
      if (prop === "events") return emitter;
      if (gameMethods.hasOwnProperty(prop)) return gameMethods[prop];
      return Reflect.get(target, prop);
    },
  }));
}

import { convertFunctionToConstructor } from "jabr";

function defaultGameLoop() {
  let shouldStop = false;
  let animationRequestID = null;
  let renderers;
  let tickers;
  let gameCore = null;
  const mainLoop = async () => {
    if (shouldStop) return;
    gameCore.events.emit("tick");
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          await ticker.tick();
        } catch (err) {
          console.error(err);
        }
      }),
    );
    await Promise.all(
      renderers.map(async (renderer) => {
        if (!renderer.checkMounted || renderer.checkMounted()) {
          try {
            await renderer.render();
          } catch (err) {
            console.error(err);
          }
        }
      }),
    );
    if (!shouldStop) animationRequestID = requestAnimationFrame(mainLoop);
  };
  const mountListener = (mounted) => {
    shouldStop = !mounted;
    if (mounted) {
      animationRequestID = requestAnimationFrame(mainLoop);
    } else if (animationRequestID !== null) {
      cancelAnimationFrame(animationRequestID);
      animationRequestID = null;
    }
  };
  const mount = async (gameCoreIn) => {
    gameCore = gameCoreIn;
    renderers = gameCore.getPlugins("renderer");
    tickers = gameCore
      .getPlugins()
      .filter((plugin) => typeof plugin?.tick == "function");
    gameCore.on("mounted", mountListener);
  };
  const unmount = (gameCore) => {
    gameCore.off("mounted", mountListener);
    shouldStop = true;
  };
  return { mount, unmount, types: ["gameLoop"] };
}

export default convertFunctionToConstructor(defaultGameLoop);

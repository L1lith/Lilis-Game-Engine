import { convertFunctionToConstructor } from "jabr";

function defaultGameLoop() {
  let shouldStop = false;
  let animationRequestID = null;
  let renderers;
  let tickers;
  let gameCore = null;
  let startTime = null;
  let lastTick = null;
  let frameCount = null;
  const mainLoop = async () => {
    if (shouldStop) return;
    const tickStart = Date.now();
    if (startTime === null) startTime = tickStart;
    if (frameCount === null) frameCount = 0;
    const lifespan = tickStart - startTime;
    const delta = isFinite(lastTick) ? tickStart - lastTick : 0;
    const timingData = {
      lifespan,
      startTime,
      frameCount,
      lastTick,
      tickStart,
      delta,
    };
    gameCore.events.emit("tick", timingData);
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          await ticker.tick(timingData);
        } catch (err) {
          console.error(err);
        }
      }),
    );
    await Promise.all(
      renderers.map(async (renderer) => {
        if (!renderer.checkMounted || renderer.checkMounted()) {
          try {
            await renderer.render(timingData);
          } catch (err) {
            console.error(err);
          }
        }
      }),
    );
    lastTick = tickStart;
    frameCount++;
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
    startTime = null;
    frameCount = null;
    lastTick = null;
    gameCore.off("mounted", mountListener);
    shouldStop = true;
  };
  return { mount, unmount, types: ["gameLoop"] };
}

export default convertFunctionToConstructor(defaultGameLoop);

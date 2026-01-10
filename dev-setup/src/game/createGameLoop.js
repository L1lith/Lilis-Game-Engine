import { Signal } from "jabr";

export default function defaultGameLoop() {
  let shouldStop = false;
  let animationRequestID = null;
  let renderers;
  let tickers;
  let gameCore = null;
  let frameNumber = -1;
  const { get: getFrameData, set: setFrameData } = Signal({
    number: frameNumber,
  });
  const mainLoop = async () => {
    if (shouldStop) return;
    frameNumber++;
    const currentFrameData = { number: frameNumber };
    setFrameData(currentFrameData);
    await Promise.all(tickers.map((t) => t.tick(currentFrameData))); // Run all plugins with tick handlers
    gameCore.events.emit("tick", currentFrameData); // Emit the tick event
    gameCore.events.emit("renderStart", currentFrameData);
    await Promise.all(
      // Run all the renderers
      renderers.map(async (renderer) => {
        if (!renderer.checkMounted || renderer.checkMounted())
          await renderer.render(currentFrameData);
      })
    );
    gameCore.events.emit("renderEnd", currentFrameData);
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
  return { mount, unmount, types: ["gameLoop"], getFrameData };
}

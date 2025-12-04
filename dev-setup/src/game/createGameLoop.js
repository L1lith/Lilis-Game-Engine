export default function defaultGameLoop() {
  let shouldStop = false;
  let animationRequestID = null;
  let renderers;
  let gameCore = null;
  const mainLoop = async () => {
    if (shouldStop) return;
    gameCore.events.emit("tick");
    await Promise.all(
      renderers.map(async (renderer) => {
        if (!renderer.checkMounted || renderer.checkMounted())
          await renderer.render();
      })
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
    gameCore.on("mounted", mountListener);
  };
  const unmount = (gameCore) => {
    gameCore.off("mounted", mountListener);
    shouldStop = true;
  };
  return { mount, unmount, types: ["gameLoop"] };
}

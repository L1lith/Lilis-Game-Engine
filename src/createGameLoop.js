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
  const groupByPriority = (plugins, priorityProperty) => {
    const groups = {};

    plugins.forEach((plugin) => {
      const priority = plugin[priorityProperty] || 0;
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(plugin);
    });

    // Sort priorities from lowest to highest
    const sortedPriorities = Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b);

    return sortedPriorities.map((priority) => groups[priority]);
  };
  const executeByPriorityGroups = async (priorityGroups, method, args) => {
    for (const priorityGroup of priorityGroups) {
      await Promise.all(
        priorityGroup.map(async (plugin) => {
          try {
            await plugin[method](...args);
          } catch (err) {
            console.error(err);
          }
        }),
      );
    }
  };
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
    const tickGroups = groupByPriority(tickers, "tickPriority");
    await executeByPriorityGroups(tickGroups, "tick", [timingData]);
    const renderGroups = groupByPriority(renderers, "renderPriority");
    await executeByPriorityGroups(renderGroups, "render", [timingData]);
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

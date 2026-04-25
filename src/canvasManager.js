import { convertFunctionToConstructor } from "jabr";

function createCanvasManager(renderSettings, options = {}) {
  const {
    computeDimensions = ({ windowWidth, windowHeight }) => ({
      width: windowWidth,
      height: windowHeight,
    }),
    autoResize = true,
    useDevicePixelRatio = true,
  } = options;

  const applyDimensions = () => {
    const dims = computeDimensions({
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    if (
      !dims ||
      typeof dims.width !== "number" ||
      typeof dims.height !== "number"
    ) {
      throw new Error("computeDimensions must return { width, height }");
    }

    const dpr = useDevicePixelRatio ? window.devicePixelRatio || 1 : 1;

    const newWidth = Math.floor(dims.width * dpr);
    const newHeight = Math.floor(dims.height * dpr);

    // Prevent unnecessary writes (VERY important to avoid loops)
    if (
      renderSettings.canvas.width === newWidth &&
      renderSettings.canvas.height === newHeight
    )
      return;

    renderSettings.canvas.width = newWidth;
    renderSettings.canvas.height = newHeight;

    // canvas.style.width = `${dims.width}px`;
    // canvas.style.height = `${dims.height}px`;

    renderSettings.realWidth = newWidth;
    renderSettings.realHeight = newHeight;
    renderSettings.logicalWidth = dims.width;
    renderSettings.logicalHeight = dims.height;
    renderSettings.width = dims.width;
    renderSettings.height = dims.height;
    console.log("canvas stuff", dims, newWidth, newHeight);
  };

  const mount = () => {
    if (!renderSettings.canvas) {
      console.warn(
        "Could not identify a canvas for the Canvas Manager during mount",
      );
    }
    applyDimensions();
    renderSettings.on("canvas", applyDimensions);

    if (autoResize) {
      window.addEventListener("resize", applyDimensions);
    }
  };

  const unmount = () => {
    renderSettings.off("canvas", applyDimensions);
    if (autoResize) {
      window.removeEventListener("resize", applyDimensions);
    }
  };

  return {
    mount,
    unmount,
    // optional manual trigger
    doResize: applyDimensions,
  };
}

export default convertFunctionToConstructor(createCanvasManager);

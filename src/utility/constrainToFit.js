export default function constrainToFit(sourceOptions = {}, outputOptions = {}) {
  const { width = 100, height = 100 } = sourceOptions;
  const { maxWidth = 100, maxHeight = 100, grow = "fit" } = outputOptions;
  if (grow === "stretch") {
    return { width: maxWidth, height: maxHeight };
  } else {
    let sizeAdjustFactor = Math[grow === "contain" ? "max" : "min"](
      maxWidth / width,
      maxHeight / height,
    );
    if (!grow) sizeAdjustFactor = Math.min(sizeAdjustFactor, 1);
    let outputWidth = width * sizeAdjustFactor;
    let outputHeight = height * sizeAdjustFactor;
    return { width: outputWidth, height: outputHeight };
  }
}

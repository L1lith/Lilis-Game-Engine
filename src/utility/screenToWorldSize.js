// For converting DIMENSIONS (width, height) from Screen to World
// Applies ONLY inverse scale
export default function screenToWorldSize(
  screenWidth,
  screenHeight,
  canvasWidth,
  canvasHeight,
) {
  return {
    width: screenWidth * (100 / canvasWidth),
    height: screenHeight * (100 / canvasHeight),
  };
}

export default function screenToWorldPosition(
  screenX,
  screenY,
  canvasWidth,
  canvasHeight,
) {
  // Convert from screen coordinates to world coordinates (-50 to +50)
  return {
    x: screenX * (100 / canvasWidth) - 50,
    y: screenY * (100 / canvasHeight) - 50,
  };
}

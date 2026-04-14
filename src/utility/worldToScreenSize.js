export default function worldToScreenSize(
  worldWidth,
  worldHeight,
  canvasWidth,
  canvasHeight,
) {
  return {
    width: worldWidth * (canvasWidth / 100),
    height: worldHeight * (canvasHeight / 100),
  };
}

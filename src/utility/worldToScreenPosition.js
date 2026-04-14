export default function worldToScreenPosition(
  worldX,
  worldY,
  canvasWidth,
  canvasHeight,
) {
  // Convert from world coordinates (-50 to +50) to screen coordinates
  // World: -50 to +50, Screen: 0 to canvasWidth/canvasHeight
  return {
    x: (worldX + 50) * (canvasWidth / 100),
    y: (worldY + 50) * (canvasHeight / 100),
  };
}

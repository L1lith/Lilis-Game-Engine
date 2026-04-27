import Matter from "matter-js";
import Entity from "../createEntity.js";
const { Bodies, Composite } = Matter;

export default function pixiTiledToMatter(pixiTiledMap, layerFilter) {
  const targetLayers =
    typeof layerFilter == "function"
      ? pixiTiledMap.mapData.layers.filter((layer) => layerFilter(layer))
      : pixiTiledMap.mapData.layers;

  const bodies = [];

  // Updated world dimensions to match your desired coordinate system
  // x: -333 to +333 = 666 total width
  // y: -50 to +50 = 100 total height
  const worldWidth = pixiTiledMap.width; // Total width from -333 to +333
  const worldHeight = pixiTiledMap.height; // Total height from -50 to +50

  targetLayers.forEach((layer) => {
    const { width: gridWidth, height: gridHeight, tiles } = layer;

    // Calculate tile size based on GRID dimensions
    const tileSizeX = worldWidth / gridWidth;
    const tileSizeY = worldHeight / gridHeight;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const index = y * gridWidth + x;
        const tile = tiles[index];

        if (tile) {
          // Convert grid coordinates to world coordinates
          // Center the map at (0, 0) so:
          // x ranges from -worldWidth/2 to +worldWidth/2 (-333 to +333)
          // y ranges from -worldHeight/2 to +worldHeight/2 (-50 to +50)
          const worldX = (x - gridWidth / 2) * tileSizeX + tileSizeX / 2;
          const worldY = (y - gridHeight / 2) * tileSizeY + tileSizeY / 2;

          const body = Bodies.rectangle(worldX, worldY, tileSizeX, tileSizeY, {
            isStatic: true,
            label: `tile_${x}_${y}`,
            // Visual debugging
            render: {
              fillStyle: "#ff0000",
              strokeStyle: "#000000",
              lineWidth: 1,
              opacity: 0.5,
            },
          });

          bodies.push(body);
        }
      }
    }
  });

  console.log(`Created ${bodies.length} collision bodies`);
  if (bodies.length > 0) {
    console.log("First tile at:", bodies[0].position);
  }

  return new Entity({
    x: 0,
    y: 0,
    width: worldWidth,
    height: worldHeight,
    matter: { predefined: bodies },
    noRender: true,
    ignoreSceneCamera: true,
  });
}

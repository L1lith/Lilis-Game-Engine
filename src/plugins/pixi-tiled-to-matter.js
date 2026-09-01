import decomp from "poly-decomp";
import Matter from "matter-js";
import Entity from "../createEntity.js";
const { Bodies, Composite, Common } = Matter;
Common.setDecomp(decomp);

const getLayerProperty = (layer, propertySearch) => {
  if (typeof propertySearch != "string")
    throw new Error("Invalid Property Name");
  const propertyMatch = layer.properties.find(
    (property) => property?.name === propertySearch,
  );
  if (!propertyMatch) return null;
  return propertyMatch.value;
};

export default function pixiTiledToMatter(pixiTiledMap, layerFilter) {
  let targetLayers =
    typeof layerFilter == "function"
      ? pixiTiledMap.mapData.layers.filter((layer) => layerFilter(layer))
      : pixiTiledMap.mapData.layers;

  //console.log("a", targetLayers.length);
  targetLayers = targetLayers.filter(
    (layer) =>
      getLayerProperty(layer, "collision") === true ||
      getLayerProperty(layer, "sensors") === true,
  );
  //console.log("b", targetLayers.length);

  const bodies = [];

  // Updated world dimensions to match your desired coordinate system
  // x: -333 to +333 = 666 total width
  // y: -50 to +50 = 100 total height
  const worldWidth = pixiTiledMap.width; // Total width from -333 to +333
  const worldHeight = pixiTiledMap.height; // Total height from -50 to +50
  const realWidth = pixiTiledMap.mapData.width * pixiTiledMap.mapData.tilewidth;
  const realHeight =
    pixiTiledMap.mapData.height * pixiTiledMap.mapData.tileheight;
  targetLayers.forEach((layer) => {
    const { width: gridWidth, height: gridHeight, tiles } = layer;
    //console.log({ gridWidth, gridHeight });
    const isSensorLayer = getLayerProperty(layer, "sensors") === true;
    // Calculate tile size based on GRID dimensions
    if (layer.type === "objectgroup") {
      // Dealing with shapes instead of tile grids
      for (let i = 0; i < layer.objects.length; i++) {
        const object = layer.objects[i];
        let body;
        if (object.polygon) {
          const objectMinX = Math.min(...object.polygon.map((obj) => obj.x));
          const objectMinY = Math.min(...object.polygon.map((obj) => obj.y));
          const objectWidth =
            Math.max(...object.polygon.map((obj) => obj.x)) - objectMinX;
          const objectHeight =
            Math.max(...object.polygon.map((obj) => obj.y)) - objectMinY;
          const shapeWidth = (objectWidth / realWidth) * 100;
          const shapeHeight = (objectHeight / realHeight) * 100;
          const centerX =
            ((object.x + objectMinX) / realWidth) * 100 - 50 + shapeWidth / 2;
          const centerY =
            ((object.y + objectMinY) / realHeight) * 100 - 50 + shapeHeight / 2;
          let points = object.polygon.map(({ x, y }) => {
            const relativeX = (x - objectMinX) / objectWidth;
            const relativeY = (y - objectMinY) / objectHeight;
            return {
              x: relativeX * shapeWidth - shapeWidth / 2,
              y: relativeY * shapeHeight - shapeHeight / 2,
            };
          });
          body = Matter.Bodies.fromVertices(centerX, centerY, [points], {
            isStatic: true,
            isSensor: isSensorLayer,
            label: object.name || `polygon shape`,
          });
        } else if (object.ellipse) {
          console.warn("unsupported shape for matter body from tiled map");
        } else {
          // It's a rectangle by default
          const shapeWidth = (object.width / realWidth) * 100;
          const shapeHeight = (object.height / realHeight) * 100;
          const centerX = (object.x / realWidth) * 100 - 50 + shapeWidth / 2;
          const centerY = (object.y / realHeight) * 100 - 50 + shapeHeight / 2;
          body = Bodies.rectangle(centerX, centerY, shapeWidth, shapeHeight, {
            isStatic: true,
            isSensor: isSensorLayer,
            label: object.name || `rectangle shape`,
          });
        }
        bodies.push(body);
        body.pixiObject = object;
      }
    } else {
      // Dealing with a tile grid
      const tileSizeX = 100 / gridWidth;
      const tileSizeY = 100 / gridHeight;

      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const index = y * gridWidth + x;
          const tile = tiles[index];

          if (tile) {
            // Convert grid coordinates to world coordinates
            // Center the map at (0, 0) so:
            // x ranges from -worldWidth/2 to +worldWidth/2 (-333 to +333)
            // y ranges from -worldHeight/2 to +worldHeight/2 (-50 to +50)
            const worldX = x * tileSizeX - 50 + tileSizeX / 2; //(x - gridWidth / 2) * tileSizeX + tileSizeX / 2;
            const worldY = y * tileSizeY - 50 + tileSizeY / 2; //(y - gridHeight / 2) * tileSizeY + tileSizeY / 2;
            //console.log({ worldX, worldY });
            const body = Bodies.rectangle(
              worldX,
              worldY,
              tileSizeX,
              tileSizeY,
              {
                isStatic: true,
                isSensor: isSensorLayer,
                label: `tile_${x}_${y}`,
                // Visual debugging
                // render: {
                //   fillStyle: "#ff0000",
                //   strokeStyle: "#000000",
                //   lineWidth: 1,
                //   opacity: 0.5,
                // },
              },
            );

            bodies.push(body);
          }
        }
      }
    }
  });

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

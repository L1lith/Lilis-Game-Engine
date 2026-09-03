import { Signal, convertFunctionToConstructor } from "jabr";
import p5 from "p5/global";
import EntityListFormat from "../formats/EntityList.js";
import { valid } from "sandhands";
import RenderSettingsFormat from "../formats/RenderSettings.js";
import { worldToScreenPosition, worldToScreenSize } from "../utility/index.js";

const standardShapes = [
  "square",
  "rect",
  "ellipse",
  "circle",
  "arc",
  "line",
  "triangle",
  "quad",
  "point",
];

function createP5Renderer(entities = null, renderSettings) {
  // if (entities !== null && !valid(entities, EntityListFormat))
  //   throw new Error("Please supply a valid EntityList");
  // if (!valid(renderSettings, RenderSettingsFormat))
  //   throw new Error("Please supply valid RenderSettings");
  entities = entities.deepFlat;
  const p5Instance = new Signal(null);
  const [getInstance, setInstance] = p5Instance;
  const mount = async () => {
    if ((!renderSettings.container) instanceof HTMLElement)
      throw new Error("Cannot mount, missing container");
    await new Promise((res) => {
      new p5((p) => {
        p.setup = async () => {
          if (renderSettings.canvas instanceof HTMLCanvasElement) {
            const [width, height] =
              typeof renderSettings.calculateDimensions == "function"
                ? renderSettings.calculateDimensions(
                    p.windowWidth,
                    p.windowHeight,
                  )
                : [200, 200];
            p.createCanvas(width, height, renderSettings.canvas);
          }
          p.windowResized = () => {
            if (typeof renderSettings.calculateDimensions == "function") {
              const [width, height] = renderSettings.calculateDimensions(
                p.windowWidth,
                p.windowHeight,
              );
              p.createCanvas(width, height, renderSettings.canvas);
            }
          };
          if (renderSettings.fitToScreen) p.noLoop();
          if (typeof renderSettings.setup == "function") {
            try {
              await renderSettings.setup(p);
            } catch (e) {
              console.error(e);
            }
          }
        };

        p.draw = async () => {
          if (entities.get().length > 0) {
            for (
              let i = 0, fetchedEntities = entities.get();
              i < fetchedEntities.length;
              i++
            ) {
              const entity = fetchedEntities[i];
              if (typeof entity.fill == "string") {
                p.fill(entity.fill);
              } else if (Array.isArray(entity.fill)) {
                p.fill(...entity.fill);
              }
              if (typeof entity.stroke == "string") {
                p.stroke(entity.stroke);
              } else if (Array.isArray(entity.stroke)) {
                p.stroke(...entity.stroke);
              }
              if ("prerender" in entity) {
                // Allow us to add behavior before the automatic shape drawing
                if (!(typeof entity.prerender == "function")) {
                  console.error(new Error("Invalid Pre-Render Function"));
                  continue;
                }
                try {
                  await entity.prerender(p, entity);
                } catch (error) {
                  console.error(error);
                }
              }
              if ("shape" in entity) {
                const { shape, x, y, width, height } = entity;
                const { width: canvasWidth, height: canvasHeight } = p;
                const { x: entityCenterCanvasX, y: entityCenterCanvasY } =
                  worldToScreenPosition(x, y, canvasWidth, canvasHeight);
                const { width: entityCanvasWidth, height: entityCanvasHeight } =
                  worldToScreenSize(width, height, canvasWidth, canvasHeight);
                // Automatically render the entity's shape
                if (!standardShapes.includes(shape)) {
                  console.error(new Error("Invalid Shape Provided"));
                  continue;
                }
                if (shape === "rect") {
                  p.rect(
                    entityCenterCanvasX - entityCanvasWidth / 2,
                    entityCenterCanvasY - entityCanvasHeight / 2,
                    entityCanvasWidth,
                    entityCanvasHeight,
                  );
                } else {
                  console.warn(
                    "Unimplemented shape, skipping: " + entity.shape,
                  );
                }
                // Render the specified shape
              }
              if ("render" in entity) {
                // Standard rendering behavior happens after the shape drawing
                if (!(typeof entity.render == "function")) {
                  console.error(new Error("Invalid Render Function"));
                  continue;
                }
                try {
                  await entity.render(p, entity);
                } catch (error) {
                  console.error(error);
                }
              }
            }
          }
          if (typeof renderSettings.draw == "function") {
            try {
              await renderSettings.draw(p);
            } catch (e) {
              console.error(e);
            }
          }
        };
        setInstance(p);
        res();
      }, renderSettings.container);
    });
  };
  const unmount = () => {
    getInstance().remove();
    setInstance(null);
  };
  const render = async () => {
    if (!getInstance()) return console.warn("Unable to find p5 instance");
    if (typeof getInstance?.redraw == "function")
      return console.warn("Unable to find the redraw method");
    getInstance().redraw();
  };
  return { mount, unmount, p5Instance, render };
}

export default convertFunctionToConstructor(createP5Renderer);

export default function createPixelProxy(p) {
  // Supports both P5js pixel data and browser native ImageData objects
  const w = p.width;
  const h = p.height;
  const d = p.pixelDensity ? p.pixelDensity() : 1;
  const pixels = p?.pixels || p?.data || null;
  if (pixels === null) throw new Error("Unable to locate pixel data");
  const pdWidth = w * d;
  const pdHeight = h * d;

  function makePixelProxy(x = null, y = null) {
    return new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "raw") {
            return { pixels, w, h, d, pdWidth, pdHeight };
          } else if (x === null && y === null) {
            // First level: rows
            return makePixelProxy(Number(prop), null);
          } else if (y === null) {
            // Second level: columns
            return makePixelProxy(x, Number(prop));
          } else if (prop === Symbol.iterator) {
            // ★ NEW: make pixels[x][y] iterable
            const idx = 4 * (y * pdWidth + x);
            return function* () {
              yield pixels[idx];
              yield pixels[idx + 1];
              yield pixels[idx + 2];
              yield pixels[idx + 3];
            };
          } else if (prop === "rgba") {
            // Return object for RGBA access
            const idx = 4 * (y * pdWidth + x);
            return {
              get r() {
                return pixels[idx];
              },
              get g() {
                return pixels[idx + 1];
              },
              get b() {
                return pixels[idx + 2];
              },
              get a() {
                return pixels[idx + 3];
              },
              set r(val) {
                pixels[idx] = val;
              },
              set g(val) {
                pixels[idx + 1] = val;
              },
              set b(val) {
                pixels[idx + 2] = val;
              },
              set a(val) {
                pixels[idx + 3] = val;
              },
            };
          } else if (prop === "array") {
            // Return array [r,g,b,a]
            const idx = 4 * (y * pdWidth + x);
            return [
              pixels[idx],
              pixels[idx + 1],
              pixels[idx + 2],
              pixels[idx + 3],
            ];
          } else {
            // Default: allow direct RGBA access by index
            const idx = 4 * (y * pdWidth + x) + Number(prop);
            return pixels[idx];
          }
        },
        set(_, prop, value) {
          const idx = 4 * (y * pdWidth + x) + Number(prop);
          pixels[idx] = value;
          return true;
        },
      }
    );
  }

  return makePixelProxy();
}

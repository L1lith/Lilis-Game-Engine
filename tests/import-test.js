import { expect } from "chai";
import * as LGE from "../src/index.js"; // Import from your source

describe("Package Import Tests", () => {
  it("should import the package successfully", () => {
    expect(typeof LGE).to.equal("object");
  });

  it("should have expected core exports", () => {
    // Add properties you expect to export
    const expectedExports = [
      "PixiRenderer",
      "GameLoop",
      "GameCore",
      "Entity",
      "EntityList",
      "RenderSettings",
    ];
    for (let i = 0; i < expectedExports.length; i++) {
      expect(LGE).to.respondTo(expectedExports[i]);
    }
  });
});

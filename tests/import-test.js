import { expect } from "chai";
import * as LGE from "../src/index.js"; // Import from your source

describe("Package Import Tests", () => {
  it("should import the package successfully", () => {
    expect(typeof LGE).to.equal("object");
  });

  it("should have expected core exports", () => {
    // Add properties you expect to export
    const expectedConstructors = [
      "GameLoop",
      "GameCore",
      "Entity",
      "EntityList",
      "RenderSettings",
    ];
    for (let i = 0; i < expectedConstructors.length; i++) {
      expect(LGE).to.respondTo(expectedConstructors[i]); // default class style import
      expect(LGE).to.respondTo("create" + expectedConstructors[i]); // supports functional style import
    }
    expect(LGE).to.not.respondTo("QOIEW1512JEFOSJsfsef"); // Doesn't respond to non-sense imports, meaning the above tests are meaningful
  });
  it("should have the expected plugin libraries", async () => {
    const expectedPlugins = ["pixi", "p5"];
    for (let i = 0; i < expectedPlugins.length; i++) {
      const expectedPlugin = expectedPlugins[i];
      const plugin = await import("../src/plugins/" + expectedPlugin + ".js");
      expect(typeof plugin).to.be.oneOf(["object", "function"]);
      expect(plugin).to.not.equal(null);
    }
  });
});

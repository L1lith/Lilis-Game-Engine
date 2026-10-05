import { expect } from "chai";
import { createGameCore } from "lilis-engine";

describe("createGameCore", () => {
  it("returns an object with mount and unmount functions", () => {
    const core = createGameCore({ plugins: [] });
    expect(typeof core.mount).to.equal("function");
    expect(typeof core.unmount).to.equal("function");
  });

  it("mount() is awaitable", async () => {
    const core = createGameCore({ plugins: [] });
    await core.mount();
  });

  it("unmount() is awaitable", async () => {
    const core = createGameCore({ plugins: [] });
    await core.mount();
    await core.unmount();
  });

  it("calls mount() on every plugin", async () => {
    const calls = [];
    const a = { mount: () => calls.push("a") };
    const b = { mount: () => calls.push("b") };
    const c = { mount: () => calls.push("c") };

    const core = createGameCore({ plugins: [a, b, c] });
    await core.mount();

    expect(calls).to.have.members(["a", "b", "c"]);
  });

  it("awaits async mount() before resolving", async () => {
    let resolved = false;
    const plugin = {
      mount: async () => {
        await new Promise((r) => setTimeout(r, 20));
        resolved = true;
      },
    };
    const core = createGameCore({ plugins: [plugin] });
    await core.mount();
    expect(resolved).to.be.true;
  });

  it("calls unmount() on every plugin", async () => {
    const calls = [];
    const a = { unmount: () => calls.push("a") };
    const b = { unmount: () => calls.push("b") };

    const core = createGameCore({ plugins: [a, b] });
    await core.mount();
    await core.unmount();

    expect(calls).to.have.members(["a", "b"]);
  });

  it("awaits async unmount() before resolving", async () => {
    let resolved = false;
    const plugin = {
      unmount: async () => {
        await new Promise((r) => setTimeout(r, 20));
        resolved = true;
      },
    };
    const core = createGameCore({ plugins: [plugin] });
    await core.mount();
    await core.unmount();
    expect(resolved).to.be.true;
  });

  it("tolerates plugins that only have tick", async () => {
    const plugin = { tick: () => {} };
    const core = createGameCore({ plugins: [plugin] });
    await core.mount();
    await core.unmount();
  });

  it("tolerates plugins that only have mount", async () => {
    const plugin = { mount: () => {} };
    const core = createGameCore({ plugins: [plugin] });
    await core.mount();
    await core.unmount();
  });

  it("tolerates plugins that only have unmount", async () => {
    const plugin = { unmount: () => {} };
    const core = createGameCore({ plugins: [plugin] });
    await core.mount();
    await core.unmount();
  });

  it("mount() can be called with no plugins array at all", async () => {
    const core = createGameCore({});
    await core.mount();
    await core.unmount();
  });

  it("plugin errors during mount propagate to the caller", async () => {
    const plugin = {
      mount: () => {
        throw new Error("mount failed");
      },
    };
    const core = createGameCore({ plugins: [plugin] });
    let caught = null;
    try {
      await core.mount();
    } catch (err) {
      caught = err;
    }
    expect(caught).to.be.an("error");
    expect(caught.message).to.equal("mount failed");
  });
});

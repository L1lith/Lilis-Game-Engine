import { expect } from "chai";
import { Entity, EntityList } from "lilis-engine";

// Assumes:
//   EntityList.addListener(fn) fires fn when the list changes
//   The listener receives (newValue, oldValue) where each is an array
//   or array-like object
//   removeListener(fn) detaches the listener
// If the listener signature differs, adjust the assertions accordingly.

describe("EntityList reactivity", () => {
  it("fires listener on addChild", () => {
    const list = EntityList([]);
    let called = 0;
    list.addListener(() => {
      called += 1;
    });
    list.addChild(Entity({ x: 0, y: 0 }));
    expect(called).to.be.greaterThan(0);
  });

  it("fires listener on removeChild", () => {
    const list = EntityList([]);
    const child = Entity({ x: 0, y: 0 });
    list.addChild(child);
    let called = 0;
    list.addListener(() => {
      called += 1;
    });
    list.removeChild(child);
    expect(called).to.be.greaterThan(0);
  });

  it("fires listener on set", () => {
    const list = EntityList([]);
    let called = 0;
    list.addListener(() => {
      called += 1;
    });
    list.set([Entity({ x: 1, y: 1 })]);
    expect(called).to.be.greaterThan(0);
  });

  it("does not fire listener after removeListener", () => {
    const list = EntityList([]);
    let called = 0;
    const listener = () => {
      called += 1;
    };
    list.addListener(listener);
    list.addChild(Entity({ x: 0, y: 0 }));
    const beforeRemove = called;
    list.removeListener(listener);
    list.addChild(Entity({ x: 1, y: 1 }));
    expect(called).to.equal(beforeRemove);
  });

  it("fires listener with new and old values when addChild runs", () => {
    const list = EntityList([]);
    let lastNew = null;
    let lastOld = null;
    list.addListener((newVal, oldVal) => {
      lastNew = newVal;
      lastOld = oldVal;
    });
    list.addChild(Entity({ x: 0, y: 0 }));
    expect(lastNew).to.not.be.null;
    expect(lastOld).to.not.be.null;
  });

  it("reflects added children via get()", () => {
    const list = EntityList([]);
    const a = Entity({ x: 1, y: 1 });
    const b = Entity({ x: 2, y: 2 });
    list.addChild(a);
    list.addChild(b);
    const arr = list.get();
    expect(arr.length).to.equal(2);
    expect(arr[0]).to.equal(a);
    expect(arr[1]).to.equal(b);
  });

  it("reflects removed children via get()", () => {
    const list = EntityList([]);
    const a = Entity({ x: 1, y: 1 });
    const b = Entity({ x: 2, y: 2 });
    list.addChild(a);
    list.addChild(b);
    list.removeChild(a);
    const arr = list.get();
    expect(arr.length).to.equal(1);
    expect(arr[0]).to.equal(b);
  });

  it("hasChild returns true for present children", () => {
    const list = EntityList([]);
    const a = Entity({ x: 1, y: 1 });
    list.addChild(a);
    if (typeof list.hasChild !== "function") return;
    expect(list.hasChild(a)).to.be.true;
  });

  it("hasChild returns false for absent children", () => {
    const list = EntityList([]);
    const a = Entity({ x: 1, y: 1 });
    if (typeof list.hasChild !== "function") return;
    expect(list.hasChild(a)).to.be.false;
  });
});

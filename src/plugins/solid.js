import { untrack, from } from "solid-js";
import { convertFunctionToConstructor, createSignal } from "jabr";
//import createSolidGetter from "jabr/solid-getter";

function createSolidGetter(jabrSignal) {
  return from(
    (set) => {
      // Subscribe to the jabr signal and update the Solid signal on changes
      const changeListener = (newValue) => {
        set(newValue);
      };
      jabrSignal.addListener(changeListener);

      // Return the cleanup function to unsubscribe
      return () => jabrSignal.removeListener(changeListener);
    },
    jabrSignal.get(), // Use current value from jabr signal as initial value
  );
}

function createSolidRenderer(entities, renderSettings) {
  entities = entities.deepFlat;
  const { solidSetter } = renderSettings;
  const {
    get: getSolidChildren,
    set: setSolidChildren,
    self: childrenSignal,
    addListener: addChildrenListener,
    removeListener: removeChildrenListener,
  } = createSignal([]);
  const renderEntity = (entity) => {
    if (entity._lastSolidValue === entity.solid) return; // Don't update as the solid value hasn't changed
    if (entity._wrappedComponent) {
      setSolidChildren(
        getSolidChildren().filter((el) => el !== entity._wrappedComponent),
      );
    }
    entity._wrappedComponent = null;
    if (typeof entity.solid == "function") {
      // Wrap the .solid property with the entity as a prop and optionally deep pass all the properties of it
      const SolidComponent = entity.solid;
      const getReactiveProp = (propName) =>
        createSolidGetter(entity.getSignal(propName));
      entity._wrappedComponent = untrack(() =>
        SolidComponent({ entity, getReactiveProp, createSolidGetter }),
      );
      // entity._wrappedComponent = _$createComponent(SolidComponent, {
      //   entity: entity,
      // });
      setSolidChildren(getSolidChildren().concat([entity._wrappedComponent]));
    }
    entity._lastSolidValue = entity.solid;
  };
  const mountEntity = (entity) => {
    entity._renderSolid = () => renderEntity(entity);
    entity.on("solid", entity._renderSolid);
    if ("solid" in entity) entity._renderSolid();
  };
  const unmountEntity = (entity) => {
    if (typeof entity._renderSolid !== "function")
      return console.warn("Unable to locate render function for: ", entity);
    entity.removeListener("solid", entity._renderSolid);
    const entityIndex = getSolidChildren().indexOf(entity._wrappedComponent);
    if (entityIndex >= 0) {
      setSolidChildren(
        getSolidChildren()
          .slice(0, entityIndex)
          .concat(getSolidChildren().slice(entityIndex + 1)),
      );
    }
  };
  const entityListListener = (newEntityList, oldEntityList) => {
    const newEntities = newEntityList.filter(
      (entity) => !oldEntityList.includes(entity),
    );
    const removedEntities = oldEntityList.filter(
      (entity) => !newEntityList.includes(entity),
    );
    newEntities.forEach(mountEntity);
    removedEntities.forEach(unmountEntity);
  };
  const solidUpdater = (newChildren) => {
    solidSetter(newChildren);
  };
  const mount = () => {
    addChildrenListener(solidUpdater);
    entities.addListener(entityListListener);
    setSolidChildren([]);
    entityListListener(entities.get(), []);
  };
  const unmount = () => {
    removeChildrenListener(solidUpdater);
    entities.removeListener(entityListListener);
    entityListListener([], entities.get());
    setSolidChildren([]);
  };
  return {
    mount,
    unmount,
    solidOutput: createSolidGetter(childrenSignal),
  };
}

export default convertFunctionToConstructor(createSolidRenderer);

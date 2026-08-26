import { createComponent as _$createComponent } from "solid-js/web";
import { convertFunctionToConstructor, createSignal } from "jabr";
import createSolidGetter from "jabr/solid";

function createSolidRenderer(entities, renderSettings) {
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
      entity._wrappedComponent = _$createComponent(SolidComponent, {
        entity: entity,
      });
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
    entity.off("solid", entity._renderSolid);
  };
  const entityListListener = (newEntityList, oldEntityList) => {
    const newEntities = newEntityList.filter(
      (entity) => !oldEntityList.contains(entity),
    );
    const removedEntities = oldEntityList.filter(
      (entity) => !newEntityList.contains(entity),
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

import { Signal } from "jabr";

export default function detectKeys(keys, callback) {
  if (typeof keys == "string") keys = [keys];
  if (keys.length < 1) throw new Error("not enough target keys");
  const comboPressed = new Signal(false);
  const pressedKeys = new Set();
  const targetKeys = new Set(keys.map((key) => key.toUpperCase()));

  document.addEventListener("keydown", (event) => {
    const key = event.key.toUpperCase();
    pressedKeys.add(key);

    // Only check for target keys if the pressed key is one of our targets
    if (targetKeys.has(key)) {
      const allPressed = Array.from(targetKeys).every((k) =>
        pressedKeys.has(k),
      );
      if (allPressed && !comboPressed.get()) {
        comboPressed.set(true);
      }
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toUpperCase();
    pressedKeys.delete(key);

    // Only check if we need to deactivate when one of our target keys is released
    if (targetKeys.has(key)) {
      comboPressed.set(false);
    }
  });

  return comboPressed;
}

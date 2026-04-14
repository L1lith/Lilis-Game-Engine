import { Signal } from "jabr";

export default function createCountdown(duration, callback = null) {
  if (!isFinite(duration))
    throw new Error("The duration is not a finite number");
  if (typeof callback != "function" && callback !== null)
    throw new Error("the callback must be a function or null");
  const currentTime = new Signal(0);
  const addTime = (ms) => {
    if (!isFinite(ms)) throw new Error("Time to add is not a finite number");
    currentTime.set(currentTime.get() + ms);
    if (currentTime.get() > duration && typeof callback == "function")
      callback();
  };

  const getRemainingTime = () => {
    return currentTime.get() - duration;
  };

  return {
    getTime: currentTime.get,
    addTime,
    signal: currentTime,
    getRemainingTime,
  };
}

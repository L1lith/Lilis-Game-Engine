import { Signal, convertFunctionToConstructor } from "jabr";

function createMusicPlayer(musicMap, options = {}) {
  const { crossfadeDuration = 500 } = options; // TODO: Implement Cross-fading
  const activeSong = Signal(null);
  const isTryingToPlay = Signal(false);
  const audioMap = {};
  let pendingSong = null;
  const clickListener = () => {
    const currentSong = audioMap[activeSong.get()];
    if (activeSong.get() && currentSong && isTryingToPlay.get())
      currentSong?.play();
  };
  const visibilityListener = () => {
    const currentSong = audioMap[activeSong.get()];
    const visible = document.visibilityState === "visible";
    if (visible && activeSong.get() && currentSong && isTryingToPlay.get()) {
      currentSong?.play();
    } else if (!visible) {
      currentSong?.pause();
    }
  };
  const setSong = (name, restart = false) => {
    loadSong(name);
    if (name === null) {
      audioMap[activeSong.get()]?.pause();
      isTryingToPlay.set(false);
      return;
    }
    if (!(name in musicMap)) throw new Error("Invalid Song Name");
    const songAudio = audioMap[name];
    isTryingToPlay.set(true);
    if (!songAudio) {
      pendingSong = name;
      return;
    }
    if (activeSong.get() && activeSong.get() !== name) {
      audioMap[activeSong.get()]?.pause();
    }
    if (activeSong.get() !== name || restart) {
      songAudio.currentTime = 0;
    }
    songAudio.play();
    activeSong.set(name);
  };
  const loadSong = (name) => {
    if (!(name in musicMap)) throw new Error("Unrecognized Song");
    if (name in audioMap) return audioMap[name];
    const url = musicMap[name];
    const songAudio = (audioMap[name] = new Audio(url));
    songAudio.loop = true;
    return songAudio;
  };
  return {
    activeSong,
    mount: () => {
      window.addEventListener("click", clickListener);
      window.addEventListener("visibilitychange", visibilityListener);
      if (pendingSong) {
        setSong(pendingSong);
        pendingSong = null;
      }
    },
    unmount: () => {
      window.removeEventListener("click", clickListener);
      setSong(null);
    },
    loadSong,
    setSong,
  };
}

export default convertFunctionToConstructor(createMusicPlayer);

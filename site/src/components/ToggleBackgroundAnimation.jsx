import { useStore } from '@nanostores/solid';
import isBackgroundActive from '@/state/isBackgroundActive';

export default function ToggleBackgroundAnimation (){
    const $isBackgroundActive = useStore(isBackgroundActive);
    const toggleBackgroundAnimation = ()=>{
        isBackgroundActive.set(!$isBackgroundActive())
        localStorage.bubbles = String($isBackgroundActive())
    }
    return <button class={$isBackgroundActive() ? "toggle-bubbles active" : "toggle-bubbles inactive"} onClick={toggleBackgroundAnimation}>{$isBackgroundActive() ? "Turn Off Bubbles" : "Turn On Bubbles"}</button>
}
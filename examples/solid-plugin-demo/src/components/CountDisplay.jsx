import { createSignal, onMount  } from "solid-js"
import { } from "solid-js"
export default function TestText({getReactiveProp}) {
    const [regular, setRegular] = createSignal(0)
    onMount(()=>{
        setInterval(()=>{
            setRegular(regular() + 1)
        }, 1000)
    })
    return <p>Time Passed: {getReactiveProp('count')} seconds, regular: {regular()}</p>
}
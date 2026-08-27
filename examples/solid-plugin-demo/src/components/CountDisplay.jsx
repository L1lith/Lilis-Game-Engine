import { createSignal, onMount  } from "solid-js"

export default function CountDisplay({getReactiveProp}) {
    const [regular, setRegular] = createSignal(0)
    onMount(()=>{
        setInterval(()=>{
            setRegular(regular() + 1)
        }, 1000)
    })
    return <p>Time Passed: {getReactiveProp('count')} seconds, regular: {regular()}</p>
}
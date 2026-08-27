export default function TestText({getReactiveProp}) {
    return <p>Time Passed: {getReactiveProp('count')} seconds</p>
}
import { useEffect, useState } from 'react'

const GIFS = [
    '/loadinggifs/luigidancing.gif',
    '/loadinggifs/krisguitar.gif',
    '/loadinggifs/shinjicup.gif',
    '/loadinggifs/sonicwaiting.gif',
]

export default function LoadingSpinner() {
    const [gif, setGif] = useState(GIFS[0])

    useEffect(() => {
        const randomGif = GIFS[Math.floor(Math.random() * GIFS.length)]
        setGif(randomGif)
    }, [])

    return (
        <img
            src={gif}
            alt="Loading..."
            className="loading-spinner-component"
            style={{
                width: '80px',
                height: '80px',
                objectFit: 'contain',
                display: 'block'
            }}
        />
    )
}

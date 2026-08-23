import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

// Helper function to create the cropped image
const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = new Image()
    image.src = imageSrc
    
    await new Promise((resolve) => { image.onload = resolve })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    )

    return new Promise((resolve, reject) => {
        canvas.toBlob((file) => {
            if (!file) {
                reject(new Error('Canvas is empty'))
                return
            }
            file.name = 'cropped.jpeg'
            
            // Create object URL for preview and keep the blob for upload
            resolve({
                blob: file,
                url: URL.createObjectURL(file)
            })
        }, 'image/jpeg', 0.95)
    })
}

export default function ImageCropperModal({ imageSrc, aspect, onCropComplete, onCancel }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
    const [loading, setLoading] = useState(false)

    const onCropCompleteCallback = useCallback((croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleSave = async () => {
        setLoading(true)
        try {
            const croppedData = await getCroppedImg(imageSrc, croppedAreaPixels)
            onCropComplete(croppedData.blob, croppedData.url)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
            <div className="modal" style={{ width: '600px', maxWidth: '95%', padding: '0', overflow: 'hidden' }}>
                <div className="modal-header" style={{ padding: 'var(--space-md)' }}>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>Ajustar Imagen</h3>
                    <button className="modal-close" onClick={onCancel}>&times;</button>
                </div>
                
                <div style={{ position: 'relative', height: '400px', background: '#111', width: '100%' }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onCropComplete={onCropCompleteCallback}
                        onZoomChange={setZoom}
                    />
                </div>
                
                <div style={{ padding: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(e.target.value)}
                            style={{ flex: 1, cursor: 'pointer' }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancelar</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                            {loading ? 'Recortando...' : 'Aplicar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

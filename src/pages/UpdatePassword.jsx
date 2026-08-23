import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { STATIC_COVERS } from '../lib/constants'
import SEO from '../components/SEO'
import './Auth.css'

export default function UpdatePassword() {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { supabase } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }

        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error

            navigate('/home')
        } catch (err) {
            console.error(err)
            setError(err.message || 'Error al actualizar contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <SEO title="Nueva contraseña" description="Establece una nueva contraseña para tu cuenta de GeekSphere." />

            <div className="auth-hero">
                <div className="auth-hero-bg">
                    <div className="auth-hero-collage">
                        {STATIC_COVERS.slice(8, 24).map((url, i) => (
                            <div key={i} className="auth-collage-img" style={{ backgroundImage: `url(${url})` }}></div>
                        ))}
                    </div>
                </div>
                <div className="auth-hero-content">
                    <img src="/icons/logo.png" alt="GeekSphere" className="auth-hero-logo" />
                    <h2>Asegura tu cuenta.</h2>
                    <p>Elige una contraseña fuerte que no hayas utilizado en otros sitios web.</p>
                </div>
            </div>

            <div className="auth-container-wrapper">
                <div className="auth-container">
                    <div className="auth-header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                        <h1 className="auth-title">Nueva contraseña</h1>
                        <p className="auth-subtitle">Elige una nueva contraseña para tu cuenta.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="auth-error slide-in">{error}</div>}

                        <div className="input-group slide-in">
                            <input
                                type="password"
                                className="input auth-input"
                                placeholder="Mínimo 6 caracteres"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="auth-actions-row slide-in" style={{ animationDelay: '0.1s', marginTop: '1rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary auth-submit-next"
                                disabled={loading}
                                style={{ width: '100%' }}
                            >
                                {loading ? 'Actualizando...' : 'Cambiar contraseña'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

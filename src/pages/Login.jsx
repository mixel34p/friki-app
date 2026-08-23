import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { STATIC_COVERS } from '../lib/constants'
import SEO from '../components/SEO'
import './Auth.css'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await signIn(email, password)
            navigate('/home')
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <SEO title="Iniciar sesión" description="Entra en GeekSphere para acceder a tu biblioteca y conectar con otros fans." />
            
            <div className="auth-hero">
                <div className="auth-hero-bg">
                    <div className="auth-hero-collage">
                        {STATIC_COVERS.slice(0, 16).map((url, i) => (
                            <div key={i} className="auth-collage-img" style={{ backgroundImage: 'url(' + url + ')' }}></div>
                        ))}
                    </div>
                </div>
                <div className="auth-hero-content">
                    <img src="/icons/logo.png" alt="GeekSphere" className="auth-hero-logo" />
                    <h2>Bienvenido de vuelta.</h2>
                    <p>Entra cuando te apetezca. Tu biblioteca, tus tierlists y tus amigos te están esperando.</p>
                </div>
            </div>

            <div className="auth-container-wrapper">
                <div className="auth-container">
                    <div className="auth-header" style={{ textAlign: 'left' }}>
                        <h1 className="auth-title">Iniciar sesión</h1>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="input-group slide-in">
                            <input
                                type="email"
                                className="input auth-input"
                                placeholder="tu@correo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group slide-in" style={{ animationDelay: '0.1s' }}>
                            <input
                                type="password"
                                className="input auth-input"
                                placeholder="Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                        </div>

                        <div className="auth-actions-row" style={{ marginTop: '1rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary auth-submit-next"
                                disabled={loading}
                                style={{ width: '100%' }}
                            >
                                {loading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>

                    <div style={{ marginTop: '2.5rem', textAlign: 'left' }}>
                        <Link to="/register" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            ¿No tienes cuenta? <span style={{ color: 'var(--text-secondary)' }}>Regístrate gratis</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

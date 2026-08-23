import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { STATIC_COVERS } from '../lib/constants'
import SEO from '../components/SEO'
import './Auth.css'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState('idle') // idle, loading, success, error
    const [error, setError] = useState('')
    const { resetPassword } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setStatus('loading')
        setError('')

        try {
            await resetPassword(email)
            setStatus('success')
        } catch (err) {
            console.error(err)
            setError('No pudimos enviar el correo. Verifica que sea correcto.')
            setStatus('error')
        }
    }

    return (
        <div className="auth-page">
            <SEO title="Recuperar contraseña" description="Recupera el acceso a tu cuenta de GeekSphere." />
            
            <div className="auth-hero">
                <div className="auth-hero-bg">
                    <div className="auth-hero-collage">
                        {STATIC_COVERS.slice(4, 20).map((url, i) => (
                            <div key={i} className="auth-collage-img" style={{ backgroundImage: `url(${url})` }}></div>
                        ))}
                    </div>
                </div>
                <div className="auth-hero-content">
                    <img src="/icons/logo.png" alt="GeekSphere" className="auth-hero-logo" />
                    <h2>¿Problemas técnicos?</h2>
                    <p>No te preocupes. Te ayudaremos a recuperar tu cuenta para que puedas volver a registrar tus obras favoritas.</p>
                </div>
            </div>

            <div className="auth-container-wrapper">
                <div className="auth-container">
                    <div className="auth-header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                        <h1 className="auth-title">Recuperar cuenta</h1>
                        <p className="auth-subtitle">Te enviaremos un enlace mágico para entrar de nuevo.</p>
                    </div>

                    {status === 'success' ? (
                        <div className="slide-in" style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📩</div>
                            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Correo enviado</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                                Revisa tu bandeja de entrada y la carpeta de spam.
                            </p>
                            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                                Volver a iniciar sesión
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="auth-form">
                            {error && <div className="auth-error slide-in">{error}</div>}

                            <div className="input-group slide-in">
                                <input
                                    type="email"
                                    className="input auth-input"
                                    placeholder="tu@correo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="auth-actions-row slide-in" style={{ animationDelay: '0.1s', marginTop: '1rem' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary auth-submit-next"
                                    disabled={status === 'loading'}
                                    style={{ width: '100%' }}
                                >
                                    {status === 'loading' ? 'Enviando...' : 'Enviar enlace'}
                                </button>
                            </div>

                            <div className="slide-in" style={{ animationDelay: '0.2s', marginTop: '2.5rem', textAlign: 'left' }}>
                                <Link to="/login" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    ¿Lo recordaste? <span style={{ color: 'var(--text-secondary)' }}>Vuelve al Login</span>
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

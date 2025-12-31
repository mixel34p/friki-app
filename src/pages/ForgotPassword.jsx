import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
            <div className="auth-container">
                <div className="auth-header">
                    <h1 className="auth-title">Recuperar cuenta.</h1>
                    <p className="auth-subtitle">
                        Te enviaremos un enlace para entrar de nuevo.
                    </p>
                </div>

                {status === 'success' ? (
                    <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📩</div>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Correo enviado</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            Revisa tu bandeja de entrada (y spam).
                        </p>
                        <Link to="/login" className="btn btn-primary btn-block">
                            Volver a iniciar sesión
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="auth-error">{error}</div>}

                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input
                                type="email"
                                className="input auth-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="tu@email.com"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block auth-submit"
                            disabled={status === 'loading'}
                        >
                            {status === 'loading' ? 'Enviando...' : 'Enviar enlace'}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link to="/login" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Volver atrás
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

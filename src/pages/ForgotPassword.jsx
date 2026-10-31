import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import './Auth.css'

export default function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState('idle')
    const [error, setError] = useState('')
    const { resetPassword } = useAuth()

    const handleSubmit = async event => {
        event.preventDefault()
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
        <div className="auth-page auth-register-page auth-flow-page">
            <SEO title="Recuperar contraseña" description="Recupera el acceso a tu cuenta de GeekSphere." />
            <div className="register-composition">
                <header className="register-hero">
                    <Link to="/home" className="register-mark" aria-label="Volver a GeekSphere"><img src="/icons/logo.png" alt="" /></Link>
                    <h1>Tu esfera de gustos,<br /><span>en un solo lugar.</span></h1>
                </header>

                <section className="register-form-section auth-flow-section" aria-labelledby="forgot-password-title">
                    <div className="auth-form-heading register-heading">
                        <h2 id="forgot-password-title">Recupera tu cuenta</h2>
                        <p>Te enviaremos un enlace para que vuelvas a entrar en GeekSphere.</p>
                    </div>

                    {status === 'success' ? <div className="auth-flow-success" role="status">
                        <span className="auth-flow-success-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>
                        </span>
                        <strong>Revisa tu correo</strong>
                        <p>Hemos enviado el enlace a <b>{email}</b>. Mira también en la carpeta de spam.</p>
                    </div> : <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="auth-error" role="alert">{error}</div>}
                        <div className="input-group">
                            <label className="input-label" htmlFor="forgot-email">Correo electrónico</label>
                            <input id="forgot-email" type="email" className="input auth-input" placeholder="tu@correo.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" autoFocus required />
                        </div>
                        <button type="submit" className="auth-submit" disabled={status === 'loading'}>{status === 'loading' ? 'Enviando…' : 'Enviar enlace'}</button>
                    </form>}

                    <div className="auth-card-footer"><Link to="/login">← Volver a iniciar sesión</Link></div>
                </section>
            </div>
        </div>
    )
}

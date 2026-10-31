import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import AuthProviderButtons from '../components/AuthProviderButtons'
import './Auth.css'

const STEPS = ['Perfil', 'Correo', 'Seguridad']

export default function Register() {
    const [step, setStep] = useState(1)
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [providerLoading, setProviderLoading] = useState('')
    const [showEmailForm, setShowEmailForm] = useState(false)
    const { signUp, signInWithProvider } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        setShowEmailForm(false)
        setStep(1)
        setError('')
    }, [location.key])

    const handleNext = event => {
        event.preventDefault()
        setError('')
        if (step === 1) {
            if (username.length < 3) return setError('El nombre de usuario debe tener al menos 3 caracteres')
            if (username.length > 20) return setError('El nombre de usuario no puede superar los 20 caracteres')
            if (!/^[a-zA-Z0-9_]+$/.test(username)) return setError('El nombre solo puede contener letras, números y guiones bajos')
            setStep(2)
        } else if (step === 2) {
            if (!email.includes('@')) return setError('Introduce un correo válido')
            setStep(3)
        }
    }

    const handleSubmit = async event => {
        event.preventDefault()
        setError('')
        if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
        setLoading(true)
        try {
            await signUp(email, password, username)
            navigate('/confirm-email')
        } catch (err) {
            setError(err.message || 'Error al registrarse')
            setLoading(false)
        }
    }

    const handleProvider = async provider => {
        setError('')
        setProviderLoading(provider)
        try {
            await signInWithProvider(provider)
        } catch (err) {
            setError(err.message || `No se pudo continuar con ${provider}`)
            setProviderLoading('')
        }
    }

    return (
        <div className="auth-page auth-register-page">
            <SEO title="Únete a GeekSphere" description="Únete a GeekSphere y empieza a organizar tus gustos en anime y videojuegos." />
            <div className="register-composition">
                <header className="register-hero">
                    <Link to="/home" className="register-mark" aria-label="Volver a GeekSphere"><img src="/icons/logo.png" alt="" /></Link>
                    <h1>Tu esfera de gustos,<br /><span>en un solo lugar.</span></h1>
                </header>
                <section className="register-form-section" aria-labelledby={showEmailForm ? 'register-title' : undefined} aria-label={!showEmailForm ? 'Opciones para unirse' : undefined}>
                    {showEmailForm && <div className="auth-form-heading register-heading">
                        {step === 1 && <h2 id="register-title">Crea tu perfil</h2>}
                        {step === 2 && <h2 id="register-title">Añade tu correo</h2>}
                        {step === 3 && <h2 id="register-title">Crea tu contraseña</h2>}
                    </div>}
                    {showEmailForm ? <>
                        <div className="register-progress" aria-label={`Paso ${step} de 3`}>
                            <div className="register-progress-track"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
                            <div className="register-progress-labels">{STEPS.map((label, index) => <span className={index + 1 <= step ? 'active' : ''} key={label}>{label}</span>)}</div>
                        </div>
                        <button type="button" className="auth-back-to-options" onClick={() => { setError(''); setShowEmailForm(false) }}>← Otras opciones</button>
                    </> : null}
                    {error && <div className="auth-error" role="alert">{error}</div>}
                    {!showEmailForm ? <>
                        <AuthProviderButtons onProvider={handleProvider} loadingProvider={providerLoading} />
                        <div className="auth-divider"><span>o</span></div>
                        <button type="button" className="auth-email-toggle" onClick={() => { setError(''); setShowEmailForm(true) }}>Usar correo en su lugar</button>
                    </> : <form onSubmit={step === 3 ? handleSubmit : handleNext} className="auth-form register-form">
                        {step === 1 && <div className="input-group">
                            <label className="input-label" htmlFor="register-username">Nombre de usuario</label>
                            <input id="register-username" type="text" className="input auth-input" placeholder="Ej.: mikasa_42" value={username} onChange={event => setUsername(event.target.value.toLowerCase().slice(0, 20))} autoComplete="username" autoFocus maxLength={20} required />
                            <span className="register-field-hint">3–20 caracteres · letras, números y _</span>
                        </div>}
                        {step === 2 && <div className="input-group">
                            <label className="input-label" htmlFor="register-email">Correo electrónico</label>
                            <input id="register-email" type="email" className="input auth-input" placeholder="tu@correo.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" autoFocus required />
                            <span className="register-field-hint">Usaremos tu correo para verificar la cuenta.</span>
                        </div>}
                        {step === 3 && <div className="input-group">
                            <label className="input-label" htmlFor="register-password">Contraseña</label>
                            <input id="register-password" type="password" className="input auth-input" placeholder="Mínimo 6 caracteres" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" autoFocus required />
                            <span className="register-field-hint">Usa al menos 6 caracteres.</span>
                        </div>}
                        <div className="register-actions">
                            {step > 1 && <button type="button" className="auth-back" onClick={() => { setError(''); setStep(step - 1) }}>Atrás</button>}
                            <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Creando…' : step === 3 ? 'Crear cuenta' : 'Continuar'}</button>
                        </div>
                    </form>}
                    <div className="auth-card-footer"><span>¿Ya tienes cuenta?</span><Link to="/login">Inicia sesión</Link></div>
                </section>
            </div>
        </div>
    )
}

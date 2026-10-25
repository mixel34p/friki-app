import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { STATIC_COVERS } from '../lib/constants'
import SEO from '../components/SEO'
import './Auth.css'

export default function Register() {
    const [step, setStep] = useState(1)
    const steps = ['Tu perfil', 'Tu correo', 'Seguridad']
    
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signUp } = useAuth()
    const navigate = useNavigate()

    const handleNext = (e) => {
        e.preventDefault()
        setError('')

        if (step === 1) {
            if (username.length < 3) {
                setError('El username debe tener al menos 3 caracteres')
                return
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                setError('El username solo puede contener letras, números y guiones bajos')
                return
            }
            setStep(2)
        } else if (step === 2) {
            if (!email.includes('@')) {
                setError('Introduce un email válido')
                return
            }
            setStep(3)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        setLoading(true)

        try {
            await signUp(email, password, username)
            navigate('/confirm-email')
        } catch (err) {
            setError(err.message || 'Error al registrarse')
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <SEO title="Crear cuenta" description="Únete a GeekSphere y empieza a organizar tus gustos en anime y videojuegos." />
            
            <div className="auth-hero">
                <div className="auth-hero-bg">
                    <div className="auth-hero-collage">
                        {STATIC_COVERS.slice(16, 32).map((url, i) => (
                            <div key={i} className="auth-collage-img" style={{ backgroundImage: `url(${url})` }}></div>
                        ))}
                    </div>
                </div>
                <div className="auth-hero-content">
                    <img src="/icons/logo.png" alt="GeekSphere" className="auth-hero-logo" />
                    <h2>Tu universo friki,<br/>tus reglas.</h2>
                    <p>Únete a la comunidad definitiva para registrar, valorar y debatir sobre tus videojuegos y animes favoritos.</p>
                </div>
            </div>

            <div className="auth-container-wrapper">
                <div className="auth-container onboarding-container register-container">
                    <div className="register-stepper" aria-label={`Paso ${step} de 3`}>
                        {steps.map((label, index) => {
                            const stepNumber = index + 1
                            const state = stepNumber < step ? 'complete' : stepNumber === step ? 'current' : ''
                            return (
                                <div className={`register-step ${state}`} key={label} aria-current={stepNumber === step ? 'step' : undefined}>
                                    <span className="register-step-number">{stepNumber < step ? '✓' : `0${stepNumber}`}</span>
                                    <span className="register-step-label">{label}</span>
                                </div>
                            )
                        })}
                    </div>

                    <div className="auth-header register-header">
                        {step === 1 && <h1 className="auth-title">¿Cómo te llamamos?</h1>}
                        {step === 2 && <h1 className="auth-title">¿Cuál es tu correo?</h1>}
                        {step === 3 && <h1 className="auth-title">Protege tu cuenta</h1>}
                        
                        <p className="auth-subtitle">
                            {step === 1 && "Este será tu nombre único en GeekSphere."}
                            {step === 2 && "Lo usaremos para recuperar tu cuenta si lo necesitas."}
                            {step === 3 && "Elige una contraseña segura."}
                        </p>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={step === 3 ? handleSubmit : handleNext} className="auth-form">
                        
                        {step === 1 && (
                            <div className="input-group slide-in">
                                <label className="input-label" htmlFor="register-username">Nombre de usuario</label>
                                <input
                                    id="register-username"
                                    type="text"
                                    className="input auth-input"
                                    placeholder="Ej: xX_Sephiroth_Xx"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                    autoFocus
                                    required
                                />
                                <span className="register-field-hint">Tu identificador único. Puedes usar letras, números y _</span>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="input-group slide-in">
                                <label className="input-label" htmlFor="register-email">Correo electrónico</label>
                                <input
                                    id="register-email"
                                    type="email"
                                    className="input auth-input"
                                    placeholder="tu@correo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <span className="register-field-hint">Te enviaremos un enlace para confirmar tu cuenta.</span>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="input-group slide-in">
                                <label className="input-label" htmlFor="register-password">Contraseña</label>
                                <input
                                    id="register-password"
                                    type="password"
                                    className="input auth-input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                    required
                                />
                                <span className="register-field-hint">Usa al menos 6 caracteres para mantener tu cuenta protegida.</span>
                            </div>
                        )}

                        <div className="auth-actions-row register-actions">
                            {step > 1 && (
                                <button type="button" className="btn btn-ghost register-back" onClick={() => setStep(step - 1)}>
                                    Atrás
                                </button>
                            )}
                            <button
                                type="submit"
                                className="btn btn-primary auth-submit-next"
                                disabled={loading}
                            >
                                {loading ? 'Creando...' : step === 3 ? 'Finalizar' : 'Continuar'}
                            </button>
                        </div>
                    </form>

                    <div className="register-footer">
                        <span>¿Ya tienes cuenta?</span>
                        <Link to="/login">
                            Inicia sesión <span aria-hidden="true">→</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

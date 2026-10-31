import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import AuthProviderButtons from '../components/AuthProviderButtons'
import './Auth.css'

const PASSWORD_LOGIN_PENDING_KEY = 'geeksphere.password-login-pending'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [providerLoading, setProviderLoading] = useState('')
    const [showEmailForm, setShowEmailForm] = useState(false)
    const { signIn, signInWithProvider, rememberCurrentAccount, supabase } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const addAccount = new URLSearchParams(location.search).get('addAccount') === '1'

    useEffect(() => {
        sessionStorage.removeItem(PASSWORD_LOGIN_PENDING_KEY)
    }, [])

    const handleSubmit = async event => {
        event.preventDefault()
        setError('')
        setLoading(true)
        sessionStorage.setItem(PASSWORD_LOGIN_PENDING_KEY, '1')
        try {
            const { user: signedInUser } = await signIn(email, password)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', signedInUser.id)
                .maybeSingle()

            if (profileError) throw profileError
            if (addAccount) await rememberCurrentAccount()
            navigate(profile ? '/home' : '/onboarding', { replace: true })
            window.setTimeout(() => sessionStorage.removeItem(PASSWORD_LOGIN_PENDING_KEY), 0)
        } catch (err) {
            sessionStorage.removeItem(PASSWORD_LOGIN_PENDING_KEY)
            setError(err.message || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    const handleProvider = async provider => {
        setError('')
        setProviderLoading(provider)
        try {
            await signInWithProvider(provider, { addAccount })
        } catch (err) {
            setError(err.message || `No se pudo continuar con ${provider}`)
            setProviderLoading('')
        }
    }

    return (
        <div className="auth-page auth-login-page">
            <SEO title="Iniciar sesión" description="Entra en GeekSphere para acceder a tu biblioteca y conectar con otros fans." />
            <div className="register-composition">
                <header className="register-hero">
                    <Link to="/home" className="register-mark" aria-label="Volver a GeekSphere"><img src="/icons/logo.png" alt="" /></Link>
                    <h1>Tu esfera de gustos,<br /><span>en un solo lugar.</span></h1>
                </header>
                <section className="register-form-section login-form-section" aria-labelledby={showEmailForm ? 'login-title' : undefined} aria-label={!showEmailForm ? 'Opciones de acceso' : undefined}>
                    {showEmailForm && <button type="button" className="auth-back-to-options" onClick={() => { setError(''); setShowEmailForm(false) }}>← Otras opciones</button>}
                    {showEmailForm && <div className="auth-form-heading register-heading"><h2 id="login-title">Inicia sesión con correo</h2></div>}
                    {error && <div className="auth-error" role="alert">{error}</div>}
                    {!showEmailForm ? <>
                        <AuthProviderButtons onProvider={handleProvider} loadingProvider={providerLoading} />
                        <div className="auth-divider"><span>o</span></div>
                        <button type="button" className="auth-email-toggle" onClick={() => { setError(''); setShowEmailForm(true) }}>Usar correo en su lugar</button>
                    </> : <>
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="input-group">
                                <label className="input-label" htmlFor="login-email">Correo electrónico</label>
                                <input id="login-email" type="email" className="input auth-input" placeholder="tu@correo.com" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required />
                            </div>
                            <div className="input-group">
                                <div className="auth-label-row"><label className="input-label" htmlFor="login-password">Contraseña</label><Link to="/forgot-password">¿La olvidaste?</Link></div>
                                <input id="login-password" type="password" className="input auth-input" placeholder="Tu contraseña" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required />
                            </div>
                            <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Entrando…' : 'Iniciar sesión'}</button>
                        </form>
                    </>}
                    <div className="auth-card-footer"><span>¿Aún no tienes cuenta?</span><Link to={`/register${addAccount ? '?addAccount=1' : ''}`}>{addAccount ? 'Crear una cuenta nueva' : 'Únete a GeekSphere'}</Link></div>
                </section>
            </div>
        </div>
    )
}

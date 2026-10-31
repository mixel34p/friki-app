import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import './Auth.css'

export default function ConfirmEmail() {
    const { supabase, loading, saveAccount, user } = useAuth()
    const navigate = useNavigate()
    const [continuing, setContinuing] = useState(false)
    const [error, setError] = useState('')
    const autoContinueStarted = useRef(false)

    const handleContinue = async () => {
        if (loading || continuing) return
        setContinuing(true)
        setError('')
        try {
            const { data: { user }, error: sessionError } = await supabase.auth.getUser()
            if (sessionError || !user) throw new Error('No encontramos una sesión iniciada para la cuenta confirmada. Abre el enlace del correo en este navegador.')

            const pendingEmail = sessionStorage.getItem('geeksphere.pending-signup-email')
            if (pendingEmail && pendingEmail !== user.email?.toLowerCase()) {
                throw new Error('La sesión activa pertenece a otra cuenta. Abre el enlace de confirmación en este navegador para continuar con la cuenta nueva.')
            }
            if (!user.email_confirmed_at && !user.confirmed_at) {
                throw new Error('Primero confirma tu correo desde el enlace que te enviamos.')
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('id', user.id)
                .maybeSingle()
            if (profileError) throw profileError

            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user?.id === user.id) saveAccount(session, profile)

            sessionStorage.removeItem('geeksphere.pending-signup-email')
            sessionStorage.removeItem('geeksphere.add-account-pending')
            if (!profile) navigate('/onboarding', { replace: true })
            else navigate(profile.username ? `/profile/${encodeURIComponent(profile.username)}` : '/home', { replace: true })
        } catch (err) {
            setError(err.message || 'No se pudo continuar. Inténtalo de nuevo.')
            setContinuing(false)
        }
    }

    useEffect(() => {
        if (loading || !user || (!user.email_confirmed_at && !user.confirmed_at) || autoContinueStarted.current) return
        autoContinueStarted.current = true
        handleContinue()
    }, [loading, user?.id])

    return (
        <div className="auth-page auth-register-page auth-flow-page">
            <SEO title="Confirma tu correo" description="Confirma tu cuenta de GeekSphere." />
            <div className="register-composition">
                <header className="register-hero">
                    <Link to="/home" className="register-mark" aria-label="Volver a GeekSphere"><img src="/icons/logo.png" alt="" /></Link>
                    <h1>Tu esfera de gustos,<br /><span>en un solo lugar.</span></h1>
                </header>

                <section className="register-form-section auth-flow-section" aria-labelledby="confirm-email-title">
                    <span className="auth-flow-success-icon auth-flow-mail-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>
                    </span>
                    <div className="auth-form-heading register-heading">
                        <h2 id="confirm-email-title">Confirma tu correo</h2>
                        <p>Te hemos enviado un enlace para confirmar tu cuenta y empezar a usar GeekSphere.</p>
                    </div>

                    <p className="auth-flow-note"><strong>¿No encuentras el correo?</strong> Mira en spam o correo no deseado. Si aún no llega, espera unos minutos.</p>
                    {error && <div className="auth-error" role="alert">{error}</div>}
                    <button type="button" className="auth-submit" onClick={handleContinue} disabled={loading || continuing}>{loading ? 'Comprobando sesión…' : continuing ? 'Continuando…' : 'Ya lo he confirmado'}</button>
                    {!loading && !continuing && <div className="auth-card-footer"><span>¿No tienes una sesión confirmada?</span><Link to="/login">Inicia sesión</Link></div>}
                </section>
            </div>
        </div>
    )
}

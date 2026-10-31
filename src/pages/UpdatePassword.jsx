import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import './Auth.css'

export default function UpdatePassword() {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { supabase } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async event => {
        event.preventDefault()
        setLoading(true)
        setError('')

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password })
            if (updateError) throw updateError
            navigate('/home')
        } catch (err) {
            console.error(err)
            setError(err.message || 'Error al actualizar contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page auth-register-page auth-flow-page">
            <SEO title="Nueva contraseña" description="Establece una nueva contraseña para tu cuenta de GeekSphere." />
            <div className="register-composition">
                <header className="register-hero">
                    <Link to="/home" className="register-mark" aria-label="Volver a GeekSphere"><img src="/icons/logo.png" alt="" /></Link>
                    <h1>Tu esfera de gustos,<br /><span>en un solo lugar.</span></h1>
                </header>

                <section className="register-form-section auth-flow-section" aria-labelledby="update-password-title">
                    <div className="auth-form-heading register-heading">
                        <h2 id="update-password-title">Crea una nueva contraseña</h2>
                        <p>Elige una contraseña segura que no hayas usado en otros sitios.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && <div className="auth-error" role="alert">{error}</div>}
                        <div className="input-group">
                            <label className="input-label" htmlFor="new-password">Nueva contraseña</label>
                            <input id="new-password" type="password" className="input auth-input" placeholder="Mínimo 6 caracteres" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" autoFocus required />
                        </div>
                        <button type="submit" className="auth-submit" disabled={loading}>{loading ? 'Actualizando…' : 'Cambiar contraseña'}</button>
                    </form>
                </section>
            </div>
        </div>
    )
}

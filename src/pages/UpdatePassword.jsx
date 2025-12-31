import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function UpdatePassword() {
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { supabase } = useAuth() // Assuming we might need direct access or verify session
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

            navigate('/home') // Or login
        } catch (err) {
            console.error(err)
            setError(err.message || 'Error al actualizar contraseña')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <h1 className="auth-title">Nueva contraseña</h1>
                    <p className="auth-subtitle">
                        Elige una nueva contraseña para tu cuenta.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="input-group">
                        <label className="input-label">Nueva contraseña</label>
                        <input
                            type="password"
                            className="input auth-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-block auth-submit"
                        disabled={loading}
                    >
                        {loading ? 'Actualizando...' : 'Cambiar contraseña'}
                    </button>
                </form>
            </div>
        </div>
    )
}

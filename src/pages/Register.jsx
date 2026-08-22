import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SEO from '../components/SEO'
import './Auth.css'

export default function Register() {
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signUp } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        // Validate username
        if (username.length < 3) {
            setError('El username debe tener al menos 3 caracteres')
            return
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('El username solo puede contener letras, números y guiones bajos')
            return
        }

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
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <SEO
                title="Crear cuenta"
                description="Únete a GeekSphere y empieza a organizar tus gustos en anime y videojuegos."
            />
            <div className="auth-container">
                <div className="auth-header">
                    <h1 className="auth-title">Crea tu perfil de gustos.</h1>
                    <p className="auth-subtitle">
                        No hay likes. No hay seguidores.<br />
                        Solo lo que te gusta.
                    </p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label className="input-label">Nombre de usuario</label>
                        <input
                            type="text"
                            className="input auth-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            type="email"
                            className="input auth-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Contraseña</label>
                        <input
                            type="password"
                            className="input auth-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-block auth-submit"
                        disabled={loading}
                    >
                        {loading ? 'Creando...' : 'Crear cuenta'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Puedes cambiarlo todo más adelante.
                    </p>
                </form>



                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <Link to="/login" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        ¿Ya tienes cuenta?
                    </Link>
                </div>
            </div>
        </div>
    )
}

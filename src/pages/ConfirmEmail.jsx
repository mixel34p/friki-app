import { Link } from 'react-router-dom'
import './Auth.css'

export default function ConfirmEmail() {
    return (
        <div className="auth-page">
            <div className="auth-container">
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                    <div style={{ marginBottom: '1rem' }}><img src="/icons/star.png" alt="✨" style={{ width: '64px', height: '64px' }} /></div>
                    <h1 className="auth-title">Revisa tu correo.</h1>
                    <p className="auth-subtitle" style={{ maxWidth: 300, margin: '0 auto 2rem auto' }}>
                        Te hemos enviado un enlace mágico para confirmar tu cuenta y empezar.
                    </p>

                    <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <p>¿No lo encuentras?</p>
                        <p>Mira en Spam o espera unos minutos.</p>
                    </div>

                    <Link to="/login" className="btn btn-primary btn-block auth-submit">
                        Ya lo he confirmado
                    </Link>
                </div>
            </div>
        </div>
    )
}

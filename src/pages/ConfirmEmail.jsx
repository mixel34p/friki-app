import { Link } from 'react-router-dom'
import { STATIC_COVERS } from '../lib/constants'
import SEO from '../components/SEO'
import './Auth.css'

export default function ConfirmEmail() {
    return (
        <div className="auth-page">
            <SEO title="Revisa tu correo" description="Confirma tu cuenta de GeekSphere." />
            
            <div className="auth-hero">
                <div className="auth-hero-bg">
                    <div className="auth-hero-collage">
                        {STATIC_COVERS.slice(12, 28).map((url, i) => (
                            <div key={i} className="auth-collage-img" style={{ backgroundImage: 'url(' + url + ')' }}></div>
                        ))}
                    </div>
                </div>
                <div className="auth-hero-content">
                    <img src="/icons/logo.png" alt="GeekSphere" className="auth-hero-logo" />
                    <h2>Solo un<br/>paso más.</h2>
                    <p>Estamos a punto de abrirte las puertas del universo friki.</p>
                </div>
            </div>

            <div className="auth-container-wrapper">
                <div className="auth-container">
                    <div className="auth-header" style={{ textAlign: 'left', marginBottom: '2rem' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <img src="/icons/star.png" alt="✨" style={{ width: '48px', height: '48px' }} />
                        </div>
                        <h1 className="auth-title">Revisa tu correo.</h1>
                        <p className="auth-subtitle">
                            Te hemos enviado un enlace mágico para confirmar tu cuenta y empezar.
                        </p>
                    </div>

                    <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <p><strong>¿No lo encuentras?</strong></p>
                        <p style={{marginTop: '0.5rem'}}>Mira en la carpeta de Spam o Correo no deseado. Si no llega, espera unos minutos.</p>
                    </div>

                    <Link to="/login" className="btn btn-primary btn-block auth-submit-next">
                        Ya lo he confirmado
                    </Link>
                </div>
            </div>
        </div>
    )
}

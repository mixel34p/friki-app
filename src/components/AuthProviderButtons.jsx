import { FaDiscord, FaTwitch } from 'react-icons/fa6'
import { FcGoogle } from 'react-icons/fc'

const PROVIDERS = [
    { id: 'google', label: 'Google', icon: <FcGoogle aria-hidden="true" />, style: 'google' },
    { id: 'discord', label: 'Discord', icon: <FaDiscord aria-hidden="true" />, style: 'discord' },
    { id: 'twitch', label: 'Twitch', icon: <FaTwitch aria-hidden="true" />, style: 'twitch' },
]

export default function AuthProviderButtons({ onProvider, loadingProvider = '' }) {
    return <div className="auth-provider-list" aria-label="Acceso con redes sociales">
        {PROVIDERS.map(provider => <button
            key={provider.id}
            type="button"
            className={`auth-provider-button ${provider.style}`}
            onClick={() => onProvider(provider.id)}
            disabled={Boolean(loadingProvider)}
        >
            <span className="auth-provider-icon">{provider.icon}</span>
            <span>{loadingProvider === provider.id ? `Conectando con ${provider.label}…` : `Continuar con ${provider.label}`}</span>
        </button>)}
    </div>
}

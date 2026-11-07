import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCopy, FiDownload, FiShare2, FiUsers } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import DefaultAvatar from '../components/DefaultAvatar'
import LoadingSpinner from '../components/LoadingSpinner'
import SEO from '../components/SEO'
import { useToast } from '../components/Toast'
import { getMyInvitation, getProfileInvitation } from '../lib/invitationService'
import { invitationRedirect, isInvitationCode, profileFavorites, readInvitation, rememberInvitation } from '../lib/invitations'
import { createInvitationCard, downloadInvitation, invitationQr } from '../lib/invitationCard'
import { hasCustomAvatar } from '../lib/avatar'
import { getProfilePalette } from '../lib/colorContrast'
import { getProfileFontStack } from '../lib/profileFonts'
import './ProfileInvitation.css'

function FavoriteCovers({ favorites }) {
    return <div className="invite-favorites" aria-label="Favoritos">
        {favorites.map((item, index) => <img key={`${item.image}-${index}`} src={item.image} alt={item.title} title={item.title} onError={event => { event.currentTarget.style.visibility = 'hidden' }} />)}
    </div>
}

function FavoriteBackdrop({ favorites }) {
    if (!favorites.length) return null
    const sideCovers = [...favorites, ...favorites].slice(0, 6)
    return <div className="invite-backdrop" aria-hidden="true">
        <div className="invite-backdrop-glow" />
        {['left', 'right'].map(side => <div className={`invite-artwork-stack invite-artwork-stack-${side}`} key={side}>
            {sideCovers.slice(side === 'left' ? 0 : 3, side === 'left' ? 3 : 6).map((item, index) => <div className={`invite-artwork invite-artwork-${index + 1}`} key={`${side}-${index}`}>
                <img className="invite-artwork-blur" src={item.image} alt="" />
                <img className="invite-artwork-cover" src={item.image} alt="" />
            </div>)}
        </div>)}
    </div>
}

export default function ProfileInvitation({ manage = false }) {
    const { code } = useParams()
    const { user, profile: ownProfile } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    const [qr, setQr] = useState('')
    const [busy, setBusy] = useState('')
    const [cardBlob, setCardBlob] = useState(null)
    const [autoFollow, setAutoFollow] = useState(true)

    useEffect(() => {
        let active = true
        setLoading(true)
        setError('')
        setResult(null)
        const request = manage ? getMyInvitation(user.id).then(data => ({ ...data, profile: ownProfile }))
            : isInvitationCode(code) ? getProfileInvitation(code) : Promise.resolve(null)
        request.then(data => {
            if (!active) return
            if (!data) setError('Esta invitación no está disponible. Puede que el enlace sea incorrecto o que el perfil ya no exista.')
            else setResult(data)
        }).catch(() => {
            if (active) setError('No se pudo cargar la invitación. Comprueba tu conexión e inténtalo de nuevo.')
        }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [manage, code, user?.id, ownProfile, attempt])

    const profile = result?.profile
    const inviteUrl = result?.code ? `${window.location.origin}/invite/${result.code}` : ''
    const favorites = profileFavorites(profile)
    const isOwner = user?.id === profile?.id

    useEffect(() => {
        let active = true
        setQr('')
        if (manage && inviteUrl) invitationQr(inviteUrl).then(value => { if (active) setQr(value) }).catch(() => {
            if (active) setError('No se pudo generar el código QR. Inténtalo de nuevo.')
        })
        return () => { active = false }
    }, [manage, inviteUrl])

    useEffect(() => {
        let active = true
        setCardBlob(null)
        if (manage && profile && inviteUrl) createInvitationCard(profile, inviteUrl).then(blob => {
            if (active) setCardBlob(blob)
        }).catch(() => { /* The explicit download action offers a retry. */ })
        return () => { active = false }
    }, [manage, profile, inviteUrl])

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteUrl)
            toast({ title: 'Enlace copiado', type: 'success' })
        } catch {
            toast({ title: 'Copia el enlace del campo', message: 'Tu navegador no permite copiar automáticamente.', type: 'info' })
            document.getElementById('invitation-link')?.select()
        }
    }

    const download = async () => {
        setBusy('download')
        try { downloadInvitation(cardBlob || await createInvitationCard(profile, inviteUrl), profile.username) }
        catch (err) { toast({ title: err.message || 'No se pudo descargar la imagen', type: 'error' }) }
        finally { setBusy('') }
    }

    const share = async () => {
        if (!navigator.share) return copyLink()
        setBusy('share')
        try {
            const payload = { title: `${profile.display_name || profile.username} te invita a GeekSphere`, text: 'Únete a mi esfera. Anime, videojuegos y mucho en común.', url: inviteUrl }
            // Keep native sharing inside the click's transient user activation.
            if (cardBlob) {
                const file = new File([cardBlob], `geeksphere-${profile.username}.png`, { type: 'image/png' })
                if (navigator.canShare?.({ files: [file] })) payload.files = [file]
            }
            await navigator.share(payload)
        } catch (err) {
            if (err.name !== 'AbortError') toast({ title: 'No se pudo compartir', message: 'Puedes copiar el enlace o descargar la imagen.', type: 'error' })
        } finally { setBusy('') }
    }

    const join = () => {
        const pending = rememberInvitation({ code: result.code, username: profile.username, autoFollow })
        const invitation = pending || { code: result.code, autoFollow }
        const target = new URL(invitationRedirect('/register', invitation))
        navigate(target.pathname + target.search)
    }

    if (loading) return <main className="invitation-page invitation-loading"><LoadingSpinner label="Preparando invitación" /></main>
    if (!profile || error) return <main className="invitation-page"><div className="invite-error" role="alert"><FiUsers size={36} /><h1>No hemos podido abrir la invitación</h1><p>{error}</p><button className="btn btn-primary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button><Link to="/home">Ir a GeekSphere</Link></div></main>

    const name = profile.display_name || profile.username
    const previous = !manage && !user ? readInvitation() : null

    return <main className={`invitation-page ${manage ? 'invitation-manage' : 'invitation-public'}`} style={getProfilePalette(null, profile.theme_color)}>
        <SEO title={manage ? 'Invita a tu esfera' : `${name} te ha invitado`} description={`${name} te invita a GeekSphere. Descubre sus favoritos y comparte tu pasión por el anime y los videojuegos.`} ogImage={profile.avatar_url || undefined} />
        <header className="invite-topbar">
            <Link to={manage ? '/home' : `/profile/${profile.username}`} className="invite-back"><FiArrowLeft />{manage ? 'Invitar' : `@${profile.username}`}</Link>
        </header>
        <div className="invite-stage">
            <FavoriteBackdrop favorites={favorites} />
            <section className="invite-card" aria-label={manage ? 'Tu tarjeta de invitación' : `Invitación de ${name}`}>
                {hasCustomAvatar(profile.avatar_url) ? <img className="invite-avatar" src={profile.avatar_url} alt="" /> : <DefaultAvatar className="invite-avatar" accent={profile.theme_color} />}
                <h2 className="invite-name" style={{ fontFamily: getProfileFontStack(profile.name_font) }}>{name}</h2>
                <Link to={`/profile/${profile.username}`} className="invite-username">@{profile.username}</Link>
                <h1 className="invite-message">{manage ? 'Comparte tu perfil' : 'Te ha invitado a GeekSphere'}</h1>
                <p className="invite-description">{manage ? 'Envía tu enlace o tu tarjeta a quien quieras.' : 'Descubre sus favoritos y comparte los tuyos.'}</p>
                {favorites.length > 0 && <FavoriteCovers favorites={favorites} />}
                {manage ? <>
                    <div className="invite-actions"><button className="btn btn-primary" onClick={share} disabled={Boolean(busy)}><FiShare2 /> {busy === 'share' ? 'Preparando…' : 'Compartir'}</button><Link className="btn btn-secondary" to={`/invite/${result.code}`}>Ver invitación</Link></div>
                    <label className="sr-only" htmlFor="invitation-link">Tu enlace de invitación</label>
                    <div className="invite-link-field"><input id="invitation-link" value={inviteUrl} readOnly onFocus={event => event.target.select()} /><button onClick={copyLink} aria-label="Copiar enlace"><FiCopy /></button></div>
                    <div className="invite-qr-block">{qr ? <img src={qr} width="88" height="88" alt="Código QR para abrir tu invitación" /> : <LoadingSpinner size="sm" />}<div><span>Tu tarjeta con código QR</span><button className="invite-download" onClick={download} disabled={Boolean(busy)}><FiDownload />{busy === 'download' ? 'Creando imagen…' : 'Descargar imagen'}</button></div></div>
                </> : user ? <>
                    <Link className="btn btn-primary invite-join" to={`/profile/${profile.username}`}>{isOwner ? 'Ver mi perfil' : 'Ver su perfil'}</Link>
                    {isOwner && <Link className="invite-preview-link" to="/invite">Compartir mi invitación</Link>}
                </> : <>
                    <label className="invite-follow-choice"><input type="checkbox" checked={autoFollow} onChange={event => setAutoFollow(event.target.checked)} /><span>Seguir a @{profile.username} al unirme</span></label>
                    {previous && previous.code !== result.code && <p className="invite-small-note">Ya aceptaste otra invitación. Se conservará la primera al crear tu cuenta.</p>}
                    <div className="invite-actions"><button className="btn btn-primary" onClick={join}>Unirme a GeekSphere</button><Link className="btn btn-secondary" to={`/profile/${profile.username}`}>Ver perfil</Link></div>
                </>}
                <Link to="/home" className="invite-card-brand">geeksphere</Link>
            </section>
        </div>
        <footer className="invite-footer"><Link to="/privacy">Privacidad</Link><Link to="/terms">Términos</Link></footer>
    </main>
}

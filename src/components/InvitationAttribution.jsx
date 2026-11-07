import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'
import { claimInvitation } from '../lib/invitationService'
import { clearInvitation, invitationFromSearch, readInvitation, rememberInvitation } from '../lib/invitations'

export default function InvitationAttribution() {
    const { user, loading } = useAuth()
    const { toast } = useToast()
    const location = useLocation()
    const userId = user?.id

    useEffect(() => {
        if (!['/register', '/onboarding', '/confirm-email'].includes(location.pathname)) return
        const incoming = invitationFromSearch(location.search)
        if (incoming) rememberInvitation(incoming)
    }, [location.pathname, location.search])

    useEffect(() => {
        if (loading || !userId) return
        if (['/register', '/login'].includes(location.pathname) || location.pathname.startsWith('/invite')) return
        const invitation = readInvitation()
        if (!invitation) return
        let active = true
        claimInvitation(invitation).then(status => {
            if (!active) return
            clearInvitation(invitation.code)
            if (status === 'completed') toast({ title: 'Invitación completada', message: 'Ya formas parte de su esfera. Puedes gestionar a quién sigues desde el perfil.', type: 'success' })
        }).catch(() => {
            if (active) toast({ title: 'No se pudo guardar la invitación', message: 'La conservamos para reintentarlo al continuar.', type: 'error' })
        })
        return () => { active = false }
    }, [loading, userId, location.pathname, toast])
    return null
}

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})
const ACCOUNTS_KEY = 'geeksphere.saved-accounts'

function readSavedAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return [] }
}

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState(readSavedAccounts)

    const saveAccount = useCallback((session, accountProfile) => {
        if (!session?.user) return
        const entry = {
            id: session.user.id,
            email: session.user.email || '',
            session,
            profile: accountProfile || null,
        }
        setAccounts(previous => {
            const next = [entry, ...previous.filter(account => account.id !== entry.id)]
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next))
            return next
        })
    }, [])

    const forgetSavedAccount = useCallback(accountId => {
        if (!accountId) return
        setAccounts(previous => {
            const next = previous.filter(account => account.id !== accountId)
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next))
            return next
        })
    }, [])

    const rememberCurrentAccount = useCallback(async () => {
        const { data } = await supabase.auth.getSession()
        if (!data.session) return
        const { data: accountProfile, error } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle()
        if (error) {
            console.warn('No se pudo comprobar si la cuenta terminó el onboarding:', error)
            return
        }
        if (accountProfile) saveAccount(data.session, accountProfile)
        else forgetSavedAccount(data.session.user.id)
    }, [saveAccount, forgetSavedAccount])

    const switchAccount = useCallback(async accountId => {
        const chosen = readSavedAccounts().find(account => account.id === accountId)
        if (!chosen?.session) throw new Error('No se encontró una sesión guardada para esa cuenta')
        await rememberCurrentAccount()
        const { error } = await supabase.auth.setSession({
            access_token: chosen.session.access_token,
            refresh_token: chosen.session.refresh_token,
        })
        if (error) throw error
        return chosen.profile || null
    }, [rememberCurrentAccount])

    const removeAccount = useCallback(async accountId => {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user?.id === accountId) await supabase.auth.signOut()
        forgetSavedAccount(accountId)
    }, [forgetSavedAccount])

    useEffect(() => {
        const syncAccounts = event => {
            if (event.key === ACCOUNTS_KEY) setAccounts(readSavedAccounts())
        }
        window.addEventListener('storage', syncAccounts)
        return () => window.removeEventListener('storage', syncAccounts)
    }, [])

    useEffect(() => {
        // ONLY use onAuthStateChange - it handles INITIAL_SESSION automatically
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('🔔 Auth event:', event, session?.user?.id || 'no user')

                if (event === 'INITIAL_SESSION') {
                    // This is the first event - session from storage
                    if (session?.user) {
                        console.log('📦 Restored session for:', session.user.id)
                        setUser(session.user)
                        if (sessionStorage.getItem('geeksphere.add-account-pending') === '1') {
                            sessionStorage.removeItem('geeksphere.add-account-pending')
                            setTimeout(async () => {
                                const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
                                saveAccount(session, data)
                            }, 0)
                        }
                        // Use setTimeout to avoid Supabase deadlock
                        setTimeout(() => loadProfile(session.user.id), 0)
                    } else {
                        console.log('👻 No stored session')
                        setLoading(false)
                    }
                } else if (event === 'SIGNED_IN') {
                    console.log('✅ Signed in:', session.user.id)
                    setUser(session.user)
                    if (sessionStorage.getItem('geeksphere.add-account-pending') === '1') {
                        sessionStorage.removeItem('geeksphere.add-account-pending')
                        setTimeout(async () => {
                            const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
                            saveAccount(session, data)
                        }, 0)
                    }
                    setTimeout(() => loadProfile(session.user.id), 0)
                } else if (event === 'SIGNED_OUT') {
                    console.log('🚪 Signed out')
                    setUser(null)
                    setProfile(null)
                    setLoading(false)
                } else if (event === 'TOKEN_REFRESHED') {
                    console.log('🔄 Token refreshed')
                    // Just update user, don't reload profile
                    if (session?.user) {
                        setUser(session.user)
                        setAccounts(previous => {
                            const existing = previous.find(account => account.id === session.user.id)
                            if (!existing) return previous
                            const next = [{ ...existing, session }, ...previous.filter(account => account.id !== session.user.id)]
                            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next))
                            return next
                        })
                    }
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [saveAccount])

    const loadProfile = async (userId) => {
        if (!userId) return null

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle()

            if (error) {
                console.error('❌ Profile error:', error)
                return null
            }

            if (data) {
                console.log('📋 Profile loaded:', data.username)
                setProfile(data)
            } else {
                console.log('👻 No profile found, user needs onboarding')
                setProfile(null)
            }
            return data
        } catch (err) {
            console.error('💥 loadProfile error:', err)
            return null
        } finally {
            setLoading(false)
        }
    }

    const signUp = async (email, password, username) => {
        const normalizedEmail = email.trim()

        // Check if username is already taken
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('username')
            .ilike('username', username)
            .maybeSingle()
            
        if (existingUser) {
            throw new Error('Ese nombre de usuario ya está cogido. ¡Prueba con otro!')
        }

        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
                data: { username }, // Store in metadata
                emailRedirectTo: `${window.location.origin}/confirm-email`
            }
        })

        if (error) {
            if (/already registered|already exists/i.test(error.message)) {
                throw new Error('Este correo ya está registrado. Inicia sesión o recupera tu contraseña.')
            }
            throw error
        }

        // Supabase hides whether an email exists when email confirmations are enabled.
        // In that case it returns a user with no identities instead of an error.
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            throw new Error('Este correo ya está registrado. Inicia sesión o recupera tu contraseña.')
        }

        return data
    }

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) throw error
        return data
    }

    const signInWithProvider = async (provider, { addAccount = false } = {}) => {
        if (addAccount) sessionStorage.setItem('geeksphere.add-account-pending', '1')
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/onboarding`,
                scopes: provider === 'google' ? 'openid email profile' : undefined
            }
        })
        if (error) {
            throw error
        }
        return data
    }

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/update-password',
        })
        if (error) throw error
    }

    const signOut = async () => {
        const { data } = await supabase.auth.getSession()
        const currentUserId = data.session?.user?.id
        if (currentUserId) {
            const { data: accountProfile, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', currentUserId)
                .maybeSingle()
            if (!error && !accountProfile) forgetSavedAccount(currentUserId)
            else if (error) console.warn('No se pudo comprobar el perfil antes de cerrar sesión:', error)
        }
        await supabase.auth.signOut()
    }

    const updateProfile = async (updates) => {
        if (!user) throw new Error('No user')

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single()

        if (error) throw error
        setProfile(data)
        return data
    }

    return (
        <AuthContext.Provider value={{
            supabase,
            user,
            profile,
            loading,
            signUp,
            signIn,
            signInWithProvider,
            signOut,
            resetPassword,
            updateProfile,
            refreshProfile: () => loadProfile(user?.id),
            accounts,
            rememberCurrentAccount,
            switchAccount,
            removeAccount,
            saveAccount
        }}>
            {children}
        </AuthContext.Provider>
    )
}

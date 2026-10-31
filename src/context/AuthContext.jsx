import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

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
                        // Use setTimeout to avoid Supabase deadlock
                        setTimeout(() => loadProfile(session.user.id), 0)
                    } else {
                        console.log('👻 No stored session')
                        setLoading(false)
                    }
                } else if (event === 'SIGNED_IN') {
                    console.log('✅ Signed in:', session.user.id)
                    setUser(session.user)
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
                    }
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [])

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
                data: { username } // Store in metadata
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

    const signInWithProvider = async (provider) => {
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
            refreshProfile: () => loadProfile(user?.id)
        }}>
            {children}
        </AuthContext.Provider>
    )
}

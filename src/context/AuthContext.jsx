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
                .eq('user_id', userId)
                .maybeSingle()

            if (error) {
                console.error('❌ Profile error:', error)
            }

            if (data) {
                console.log('📋 Profile loaded:', data.username)
                setProfile(data)
            } else {
                // FALLBACK: Create default profile if missing (rare case if signUp works right)
                // Try to get user metadata for better defaults
                const { data: { user: userData } } = await supabase.auth.getUser()
                const metaUsername = userData?.user_metadata?.username

                console.log('🆕 Creating fallback profile...')
                const { data: newProfile } = await supabase
                    .from('profiles')
                    .insert({
                        user_id: userId,
                        username: metaUsername || `user_${userId.substring(0, 8)}`,
                        display_name: metaUsername || 'Nuevo Friki',
                        color_primary: '#8b5cf6',
                        color_secondary: '#6366f1',
                        color_accent: '#f59e0b',
                        favorite_genres: [],
                        platforms: [],
                        favorite_era: 'current',
                        library: []
                    })
                    .select()
                    .single()

                if (newProfile) {
                    console.log('✅ Fallback profile created')
                    setProfile(newProfile)
                }
            }
        } catch (err) {
            console.error('💥 loadProfile error:', err)
        } finally {
            setLoading(false)
        }
    }

    const signUp = async (email, password, username) => {
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
            email,
            password,
            options: {
                data: { username } // Store in metadata
            }
        })

        if (error) throw error

        // Explicitly create profile here to ensure correct data
        if (data.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    user_id: data.user.id,
                    username: username,
                    display_name: username, // Use username as initial display name
                    color_primary: '#8b5cf6',
                    color_secondary: '#6366f1',
                    color_accent: '#f59e0b',
                    favorite_genres: [],
                    platforms: [],
                    favorite_era: 'current',
                    library: []
                })

            if (profileError) {
                console.error('Manual profile creation failed:', profileError)
                // loadProfile might fix it later via metadata
            }
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
            .eq('user_id', user.id)
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
            signOut,
            resetPassword,
            updateProfile,
            refreshProfile: () => loadProfile(user?.id)
        }}>
            {children}
        </AuthContext.Provider>
    )
}

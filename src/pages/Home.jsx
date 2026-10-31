import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LoadingSpinner from '../components/LoadingSpinner'
import './Home.css'

function getPreviewImage(tierlist) {
    if (tierlist.content && typeof tierlist.content === 'object') {
        const priorities = ['S', '#1', 'Top', 'God Tier', 'A', '#2', 'B', '#3', 'C', '#4', 'D', '#5', 'E', 'F']
        for (const key of priorities) {
            const image = tierlist.content[key]?.find?.(item => item.image_url)?.image_url
            if (image) return image
        }
        for (const row of Object.values(tierlist.content)) {
            const image = Array.isArray(row) ? row.find(item => item?.image_url)?.image_url : row?.image_url
            if (image) return image
        }
    }
    return tierlist.tierlist_items?.find(item => item.image_url)?.image_url || null
}

export default function Home() {
    const { user, profile, loading: authLoading } = useAuth()
    const [trendingTierlists, setTrendingTierlists] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (authLoading) return
        let active = true
        setLoading(true)
        const loadPublicHome = async () => {
            try {
                const { data: trends } = await supabase
                    .from('tierlists')
                    .select('*')
                    .eq('visibility', 'public')
                    .order('created_at', { ascending: false })
                    .limit(6)

                if (trends?.length) {
                    const userIds = [...new Set(trends.map(item => item.user_id).filter(Boolean))]
                    const { data: trendProfiles } = await supabase
                        .from('profiles')
                        .select('user_id, username, display_name, avatar_url')
                        .in('user_id', userIds)
                    const profileMap = Object.fromEntries((trendProfiles || []).map(item => [item.user_id, item]))
                    if (active) setTrendingTierlists(trends.map(item => ({ ...item, profiles: profileMap[item.user_id] })))
                } else if (active) setTrendingTierlists([])
            } catch (error) {
                console.error('Error loading public home:', error)
            } finally {
                if (active) setLoading(false)
            }
        }
        loadPublicHome()
        return () => { active = false }
    }, [user?.id, authLoading])

    if (loading) return <div className="home-loading"><LoadingSpinner /></div>

    const displayName = profile?.display_name || profile?.username || 'Friki'

    return (
        <div className="home guest-home">
            <section className="guest-home-hero">
                <span className="guest-home-eyebrow">TU UNIVERSO FRIKI, EN UN SOLO LUGAR</span>
                <h1>{user ? <>Hola, {displayName}.<br /><span>¿Qué te apetece explorar?</span></> : <>Todo lo que te gusta.<br /><span>En tu esfera.</span></>}</h1>
                <p>Descubre anime y videojuegos, comparte tus opiniones y encuentra gente con tus mismas aficiones.</p>
                <div className="guest-home-actions">
                    <Link className="guest-home-primary" to="/search">Explorar GeekSphere</Link>
                    {user
                        ? <Link className="guest-home-secondary" to={profile?.username ? `/profile/${profile.username}` : '/profile'}>Mi perfil</Link>
                        : <Link className="guest-home-secondary" to="/register">Únete gratis</Link>}
                </div>
                <div className="guest-home-orbit guest-home-orbit-one" aria-hidden="true" />
                <div className="guest-home-orbit guest-home-orbit-two" aria-hidden="true" />
            </section>

            <section className="guest-home-features" aria-label="Qué puedes hacer en GeekSphere">
                <article><span>✦</span><h2>Organiza lo que ves y juegas</h2><p>Guarda tus obras favoritas y lleva un diario a tu ritmo.</p></article>
                <article><span>✧</span><h2>Comparte tu opinión</h2><p>Puntúa, escribe reseñas y crea listas para recomendar.</p></article>
                <article><span>◎</span><h2>Encuentra a tu gente</h2><p>Conecta con fans que disfrutan de las mismas historias.</p></article>
            </section>

            {trendingTierlists.length > 0 && <section className="guest-home-trending">
                <div className="guest-home-section-heading"><div><span>DE LA COMUNIDAD</span><h2>Listas recientes</h2></div><Link to="/discover/lists">Ver todas <span aria-hidden="true">→</span></Link></div>
                <div className="guest-home-list-grid">
                    {trendingTierlists.slice(0, 3).map(item => {
                        const image = getPreviewImage(item)
                        return <Link className="guest-home-list-card" to={`/tierlist/${item.id}`} key={item.id}>
                            {image ? <img src={image} alt="" loading="lazy" /> : <div className="guest-home-list-placeholder">✦</div>}
                            <div><span>{item.media_type === 'game' ? 'VIDEOJUEGOS' : 'ANIME'}</span><h3>{item.title}</h3><small>por @{item.profiles?.username || 'miembro'}</small></div>
                        </Link>
                    })}
                </div>
            </section>}
        </div>
    )
}

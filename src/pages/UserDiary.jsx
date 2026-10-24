import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getUserLibrary } from '../lib/libraryService'
import { getWorkById } from '../lib/workPageService'
import LoadingSpinner from '../components/LoadingSpinner'
import '../components/LibraryGrid.css'
import './UserReviews.css' // Reusing some header styles

export default function UserDiary() {
    const { username } = useParams()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)
    const [diaryMonths, setDiaryMonths] = useState([])

    const getWorkYear = (work, type) => {
        if (!work.release_date) return '';
        if (type === 'game') {
            if (typeof work.release_date === 'number') {
                return new Date(work.release_date * 1000).getFullYear();
            }
            return new Date(work.release_date).getFullYear();
        } else {
            return new Date(work.release_date).getFullYear();
        }
    }

    const renderStars = (rating) => {
        if (!rating) return null;
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            let fill = "transparent";
            if (rating >= i) fill = "var(--brand-primary)";
            else if (rating === i - 0.5) fill = "url(#halfStarSmall)";
            stars.push(
                <svg key={i} viewBox="0 0 24 24" width="14" height="14">
                    <defs>
                        <linearGradient id={`halfStarD-${i}`} x1="0" x2="100%" y1="0" y2="0">
                            <stop offset="50%" stopColor="var(--brand-primary)" />
                            <stop offset="50%" stopColor="transparent" />
                        </linearGradient>
                    </defs>
                    <path 
                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        fill={rating === i - 0.5 ? `url(#halfStarD-${i})` : fill}
                        stroke="var(--brand-primary)"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        }
        return <div className="activity-stars">{stars}</div>
    }

    useEffect(() => {
        const fetchUserAndDiary = async () => {
            if (!username) return
            setLoading(true)
            try {
                // Get profile ID from username
                const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url, theme_color')
                    .eq('username', username)
                    .single()
                
                if (userError || !userData) {
                    console.error('User not found')
                    setLoading(false)
                    return
                }
                setProfile(userData)

                const logs = await getUserLibrary(userData.id)
                
                // Get fully populated logs
                const populatedLogs = await Promise.all(logs.map(async (log) => {
                    const workDetails = await getWorkById(log.work_type, parseInt(log.work_id))
                    return {
                        ...log,
                        work: workDetails
                    }
                }))

                const validLogs = populatedLogs.filter(log => log.work && (log.finished_date || log.created_at))
                
                // Group by month
                const monthGroups = {}
                validLogs.forEach(log => {
                    const dateObj = new Date(log.finished_date || log.created_at)
                    const shortMonth = dateObj.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().substring(0, 3)
                    const yearStr = dateObj.getFullYear()
                    const monthKey = `${shortMonth}-${yearStr}`
                    
                    if (!monthGroups[monthKey]) {
                        monthGroups[monthKey] = {
                            id: monthKey,
                            shortMonth,
                            year: yearStr,
                            dateForSort: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1),
                            entries: []
                        }
                    }
                    monthGroups[monthKey].entries.push({
                        ...log,
                        day: dateObj.getDate()
                    })
                })

                // Sort months descending (NO SLICE)
                const sortedMonths = Object.values(monthGroups).sort((a, b) => b.dateForSort - a.dateForSort)

                // Sort entries within each month by day descending
                sortedMonths.forEach(m => {
                    m.entries.sort((a, b) => b.day - a.day)
                })

                setDiaryMonths(sortedMonths)
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        
        fetchUserAndDiary()
    }, [username])

    if (loading) return <LoadingSpinner />

    // Count total entries
    const totalEntries = diaryMonths.reduce((sum, month) => sum + month.entries.length, 0)

    return (
        <div
            className="page-container user-reviews-page"
            style={profile?.theme_color ? {
                '--brand-primary': profile.theme_color,
                '--brand-dark': profile.theme_color
            } : {}}
        >
            <div className="user-page-header">
                <div className="user-page-header-content">
                    <div className="user-page-title-row">
                        <Link to={`/profile/${username}`}>
                            <div 
                                className="user-page-avatar" 
                                style={{ backgroundImage: `url(${profile?.avatar_url || '/default-avatar.png'})` }}
                            ></div>
                        </Link>
                        <h2>
                            Diario de <Link to={`/profile/${username}`} className="user-link">@{username}</Link>
                        </h2>
                    </div>
                </div>
                <div className="user-page-stats">{totalEntries} {totalEntries === 1 ? 'entrada' : 'entradas'}</div>
            </div>

            <div className="diary-list">
                {diaryMonths.length === 0 ? (
                    <div className="activity-empty">Este usuario no ha registrado ninguna obra todavía.</div>
                ) : (
                    diaryMonths.map(month => (
                        <div key={month.id} className="diary-month-group">
                            <div className="diary-month-header">
                                <div className="diary-month-calendar">
                                    <div className="calendar-rings"><span></span><span></span><span></span></div>
                                    <div className="calendar-body">{month.shortMonth}</div>
                                </div>
                                <span className="diary-month-year">{month.year}</span>
                            </div>
                            <div className="diary-entries">
                                {month.entries.map(log => (
                                    <div key={log.id} className="diary-entry">
                                        <div className="diary-day">{log.day}</div>
                                        <Link to={`/${log.work_type}/${log.work_id}`} className="diary-entry-poster">
                                            <div className="diary-micro-poster" style={{ backgroundImage: `url(${log.work_type === 'game' ? log.work.cover_url : log.work.image_url})` }}></div>
                                        </Link>
                                        <div className="diary-entry-info">
                                            <div className="diary-entry-header">
                                                <Link to={`/${log.work_type}/${log.work_id}`} className="diary-entry-title">
                                                    {log.work_type === 'game' ? log.work.name : log.work.title}
                                                </Link>
                                                <span className="diary-entry-year">
                                                    {getWorkYear(log.work, log.work_type)}
                                                </span>
                                            </div>
                                            {renderStars(log.rating)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}


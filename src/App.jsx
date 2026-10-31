import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import SEO from './components/SEO'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ConfirmEmail from './pages/ConfirmEmail'
import UpdatePassword from './pages/UpdatePassword'
import Home from './pages/Home'

import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import Library from './pages/Library'
import WorkPage from './pages/WorkPage'
import Connections from './pages/Connections'
import CompareProfiles from './pages/CompareProfiles'
import UserReviews from './pages/UserReviews'
import UserDiary from './pages/UserDiary'
import UserTierlists from './pages/UserTierlists'
import UserTemplates from './pages/UserTemplates'
import WorkReviews from './pages/WorkReviews'
import ReviewDetail from './pages/ReviewDetail'
import Search from './pages/Search'
import DiscoverWorks from './pages/DiscoverWorks'
import DiscoverLists from './pages/DiscoverLists'
import WishlistPage from './pages/WishlistPage'
import ActivityPage from './pages/ActivityPage'
import ViewTierlist from './pages/ViewTierlist'
import Chat from './pages/Chat'
import './index.css'

import { useLocation } from 'react-router-dom'
import Onboarding from './pages/Onboarding'

function getPageTitle(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const [section, identifier, subpage] = parts
  const exact = {
    '/': 'GeekSphere', '/home': 'Inicio', '/activity': 'Actividad', '/spaces': 'Espacios',
    '/search': 'Busca tus aficiones', '/search/results': 'Busca tus aficiones',
    '/connections': 'Conexiones', '/templates': 'Plantillas', '/old-library': 'Biblioteca',
    '/onboarding': 'Configura tu perfil', '/lists/new': 'Crear lista', '/settings': 'Ajustes',
  }
  if (exact[pathname]) return exact[pathname]
  if (section === 'profile') {
    const names = { reviews: 'Reseñas', diary: 'Diario', tierlists: 'Tierlists', templates: 'Plantillas', wishlist: 'Lista de deseos' }
    return subpage ? `${names[subpage] || 'Perfil'} de ${identifier || 'usuario'}` : `Perfil de ${identifier || 'usuario'}`
  }
  if (section === 'game' || section === 'anime') return identifier && parts[2] === 'reviews' ? `Reseñas de ${section === 'game' ? 'videojuegos' : 'anime'}` : section === 'game' ? 'Videojuego' : 'Anime'
  if (section === 'spaces' && identifier) return 'Espacio'
  if (section === 'lists' && identifier) return parts[2] === 'edit' ? 'Editar lista' : 'Lista'
  if (section === 'templates' && identifier) return parts[2] === 'edit' ? 'Editar plantilla' : 'Plantilla'
  if (section === 'tierlist' && identifier) return 'Tierlist'
  if (section === 'compare') return 'Comparar perfiles'
  if (section === 'discover') {
    const labels = { anime: 'animes', games: 'juegos', users: 'usuarios', spaces: 'espacios', lists: 'listas' }
    return identifier === 'users' && subpage === 'all' ? 'Todos los usuarios' : `Descubrir ${labels[identifier] || ''}`.trim()
  }
  if (section === 'chat') return 'Chat'
  return section ? section.replace(/-/g, ' ').replace(/^./, letter => letter.toLocaleUpperCase()) : 'GeekSphere'
}

function RouteTitle() {
  const location = useLocation()
  return <SEO title={getPageTitle(location.pathname)} />
}

// Lists System imports
import TemplateGallery from './pages/lists/TemplateGallery'
import ViewTemplate from './pages/lists/ViewTemplate'
import TemplateBuilder from './pages/lists/TemplateBuilder'
import CreateList from './pages/lists/CreateList'
import ViewList from './pages/lists/ViewList'

// Spaces System imports
import SpacesExplore from './pages/spaces/SpacesExplore'
import MySpaces from './pages/spaces/MySpaces'
import SpaceLayout from './pages/spaces/SpaceLayout'
import LiveChat from './pages/spaces/LiveChat'

// Protected Route component
function ProtectedRoute({ children, requireProfile = true }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <LoadingSpinner size="lg" label="Cargando" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireProfile && !profile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  
  if (!requireProfile && profile && location.pathname === '/onboarding') {
      return <Navigate to="/home" replace />
  }

  return children
}

// Public only route (redirect if logged in)
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <LoadingSpinner size="lg" label="Cargando" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/home" replace />
  }

  return children
}

// Placeholder component for pages under construction
function Placeholder({ title }) {
  return (
    <div className="container" style={{ paddingTop: '100px', textAlign: 'center', height: '100vh' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem', fontSize: '2.5rem' }}>{title}</h1>
      <p style={{ color: 'var(--text-muted)' }}>Esta página está vacía temporalmente para el rework.</p>
    </div>
  )
}

function DiscoverCategoryPlaceholder() {
  const { category } = useParams()
  const labels = { anime: 'Animes', games: 'Juegos', users: 'Usuarios', spaces: 'Espacios', lists: 'Listas' }
  return <Placeholder title={`Descubrir ${labels[category] || ''}`} />
}

function DiscoverCategoryRoute() {
  const { category } = useParams()
  if (category === 'anime' || category === 'games') return <DiscoverWorks />
  if (category === 'users') return <Navigate to="/search?filter=users" replace />
  if (category === 'spaces') return <SpacesExplore />
  if (category === 'lists') return <DiscoverLists />
  return <DiscoverCategoryPlaceholder />
}

function SpacesRootRoute() {
  const { user, profile } = useAuth()
  if (user && !profile) return <Navigate to="/onboarding" replace />
  return user ? <MySpaces /> : <SpacesExplore />
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <RouteTitle />
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          {/* Public routes */}
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/confirm-email" element={<PublicOnlyRoute><ConfirmEmail /></PublicOnlyRoute>} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* Chat Routes */}
          <Route path="/chat" element={<ProtectedRoute><Placeholder title="Chat" /></ProtectedRoute>} />
          <Route path="/chat/:connectionId" element={<ProtectedRoute><Placeholder title="Chat" /></ProtectedRoute>} />
          <Route path="/templates/:id/edit" element={<ProtectedRoute><TemplateBuilder /></ProtectedRoute>} />

          {/* Editor Routes (No Layout) */}
          <Route path="/lists/new" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />
          <Route path="/lists/:id/edit" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />

          {/* Protected routes with Layout */}
          <Route element={<Layout />}>
            <Route path="/onboarding" element={<ProtectedRoute requireProfile={false}><Onboarding /></ProtectedRoute>} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
            <Route path="/home" element={<Home />} />
            <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
            <Route path="/search" element={<Search />} />
            <Route path="/search/results" element={<Search />} />
            <Route path="/profile/:username?" element={<Profile />} />
            <Route path="/profile/:username/reviews" element={<UserReviews />} />
            <Route path="/profile/:username/diary" element={<UserDiary />} />
            <Route path="/profile/:username/tierlists" element={<UserTierlists />} />
            <Route path="/profile/:username/templates" element={<UserTemplates />} />
            <Route path="/settings/*" element={<ProtectedRoute><EditProfile standalone /></ProtectedRoute>} />
            <Route path="/reviews/:reviewId" element={<ReviewDetail />} />
            <Route path="/edit-profile" element={<Navigate to="/profile?edit=true" replace />} />
            
            {/* OLD TIERLIST REDIRECTS */}
            <Route path="/create-tierlist" element={<ProtectedRoute><Navigate to="/home?createlist=true" replace /></ProtectedRoute>} />
            <Route path="/tierlist/:id" element={<ViewTierlist />} />
            <Route path="/edit-tierlist/:id" element={<Navigate to="/lists/:id/edit" replace />} />
            
            {/* NEW LISTS SYSTEM RUTAS */}
            <Route path="/templates" element={<TemplateGallery />} />
            <Route path="/templates/new" element={<ProtectedRoute><Navigate to="/templates?new=1" replace /></ProtectedRoute>} />
            <Route path="/templates/:id" element={<ViewTemplate />} />
            <Route path="/lists/:id" element={<ViewList />} />
            
            <Route path="/discover" element={<Navigate to="/search" replace />} />
            <Route path="/discover/users/all" element={<Navigate to="/search?filter=users" replace />} />
            <Route path="/discover/:category" element={<DiscoverCategoryRoute />} />
            <Route path="/library/:username?" element={<ProtectedRoute><Navigate to="/profile" replace /></ProtectedRoute>} />
            <Route path="/old-library" element={<ProtectedRoute><Placeholder title="Biblioteca" /></ProtectedRoute>} />
            
            {/* Spaces System */}
            <Route path="/spaces" element={<SpacesRootRoute />} />
            <Route path="/spaces/explore" element={<Navigate to="/discover/spaces" replace />} />
            <Route path="/spaces/:id" element={<SpaceLayout />}>
              <Route path="chat/:channelId" element={<ProtectedRoute><LiveChat /></ProtectedRoute>} />
            </Route>

            {/* Social Discovery Routes */}
            <Route path="/connections" element={<ProtectedRoute><Placeholder title="Conexiones" /></ProtectedRoute>} />
            <Route path="/compare/:userId" element={<ProtectedRoute><Placeholder title="Comparar Perfiles" /></ProtectedRoute>} />

            {/* Work Page Routes */}
            <Route path="/game/:id" element={<WorkPage mediaType="game" />} />
            <Route path="/anime/:id" element={<WorkPage mediaType="anime" />} />
            <Route path="/game/:id/reviews" element={<WorkReviews mediaType="game" />} />
            <Route path="/anime/:id/reviews" element={<WorkReviews mediaType="anime" />} />
            <Route path="/profile/:username/wishlist" element={<WishlistPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App



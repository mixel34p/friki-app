import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ConfirmEmail from './pages/ConfirmEmail'
import UpdatePassword from './pages/UpdatePassword'

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
import Search from './pages/Search'
import DiscoverWorks from './pages/DiscoverWorks'
import DiscoverLists from './pages/DiscoverLists'
import DiscoverUsers from './pages/DiscoverUsers'
import WishlistPage from './pages/WishlistPage'
import Chat from './pages/Chat'
import './index.css'

import { useLocation } from 'react-router-dom'
import Onboarding from './pages/Onboarding'

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
  if (category === 'users') return <DiscoverUsers />
  if (category === 'spaces') return <SpacesExplore />
  if (category === 'lists') return <DiscoverLists />
  return <DiscoverCategoryPlaceholder />
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<PublicOnlyRoute><Landing /></PublicOnlyRoute>} />
          <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
          <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
          <Route path="/confirm-email" element={<PublicOnlyRoute><ConfirmEmail /></PublicOnlyRoute>} />
          <Route path="/update-password" element={<UpdatePassword />} />

          {/* Onboarding Route */}
          <Route path="/onboarding" element={<ProtectedRoute requireProfile={false}><Onboarding /></ProtectedRoute>} />

          {/* Chat Routes */}
          <Route path="/chat" element={<ProtectedRoute><Placeholder title="Chat" /></ProtectedRoute>} />
          <Route path="/chat/:connectionId" element={<ProtectedRoute><Placeholder title="Chat" /></ProtectedRoute>} />
          <Route path="/templates/:id/edit" element={<ProtectedRoute><TemplateBuilder /></ProtectedRoute>} />

          {/* Editor Routes (No Layout) */}
          <Route path="/lists/new" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />
          <Route path="/lists/:id/edit" element={<ProtectedRoute><CreateList /></ProtectedRoute>} />

          {/* Protected routes with Layout */}
          <Route element={<Layout />}>
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/search/results" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Placeholder title="Inicio (Home)" /></ProtectedRoute>} />
            <Route path="/profile/:username?" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/:username/reviews" element={<ProtectedRoute><UserReviews /></ProtectedRoute>} />
            <Route path="/profile/:username/diary" element={<ProtectedRoute><UserDiary /></ProtectedRoute>} />
            <Route path="/profile/:username/tierlists" element={<ProtectedRoute><UserTierlists /></ProtectedRoute>} />
            <Route path="/profile/:username/templates" element={<ProtectedRoute><UserTemplates /></ProtectedRoute>} />
            <Route path="/edit-profile" element={<Navigate to="/profile?edit=true" replace />} />
            
            {/* OLD TIERLIST REDIRECTS */}
            <Route path="/create-tierlist" element={<Navigate to="/home?createlist=true" replace />} />
            <Route path="/tierlist/:id" element={<Navigate to="/lists/:id" replace />} />
            <Route path="/edit-tierlist/:id" element={<Navigate to="/lists/:id/edit" replace />} />
            
            {/* NEW LISTS SYSTEM RUTAS */}
            <Route path="/templates" element={<TemplateGallery />} />
            <Route path="/templates/new" element={<Navigate to="/templates?new=1" replace />} />
            <Route path="/templates/:id" element={<ViewTemplate />} />
            <Route path="/lists/:id" element={<ViewList />} />
            
            <Route path="/discover" element={<ProtectedRoute><Navigate to="/search" replace /></ProtectedRoute>} />
            <Route path="/discover/users/all" element={<ProtectedRoute><Placeholder title="Todos los usuarios" /></ProtectedRoute>} />
            <Route path="/discover/:category" element={<ProtectedRoute><DiscoverCategoryRoute /></ProtectedRoute>} />
            <Route path="/library/:username?" element={<Navigate to="/profile" replace />} />
            <Route path="/old-library" element={<ProtectedRoute><Placeholder title="Biblioteca" /></ProtectedRoute>} />
            
            {/* Spaces System */}
            <Route path="/spaces" element={<ProtectedRoute><MySpaces /></ProtectedRoute>} />
            <Route path="/spaces/explore" element={<ProtectedRoute><Navigate to="/discover/spaces" replace /></ProtectedRoute>} />
            <Route path="/spaces/:id" element={<ProtectedRoute><SpaceLayout /></ProtectedRoute>}>
              <Route path="chat/:channelId" element={<LiveChat />} />
            </Route>

            {/* Social Discovery Routes */}
            <Route path="/connections" element={<ProtectedRoute><Placeholder title="Conexiones" /></ProtectedRoute>} />
            <Route path="/compare/:userId" element={<ProtectedRoute><Placeholder title="Comparar Perfiles" /></ProtectedRoute>} />

            {/* Work Page Routes */}
            <Route path="/game/:id" element={<ProtectedRoute><WorkPage mediaType="game" /></ProtectedRoute>} />
            <Route path="/anime/:id" element={<ProtectedRoute><WorkPage mediaType="anime" /></ProtectedRoute>} />
            <Route path="/game/:id/reviews" element={<ProtectedRoute><WorkReviews mediaType="game" /></ProtectedRoute>} />
            <Route path="/anime/:id/reviews" element={<ProtectedRoute><WorkReviews mediaType="anime" /></ProtectedRoute>} />
            <Route path="/profile/:username/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
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



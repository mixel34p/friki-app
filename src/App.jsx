import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ConfirmEmail from './pages/ConfirmEmail'
import UpdatePassword from './pages/UpdatePassword'

// Importamos los componentes, pero usaremos Placeholder temporalmente
import Home from './pages/Home'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import CreateTierlist from './pages/CreateTierlist'
import ViewTierlist from './pages/ViewTierlist'
import Library from './pages/Library'
import Discover from './pages/Discover'
import Debates from './pages/Debates'
import ViewDebate from './pages/ViewDebate'
import CreateDebate from './pages/CreateDebate'
import WorkPage from './pages/WorkPage'
import Connections from './pages/Connections'
import CompareProfiles from './pages/CompareProfiles'
import Chat from './pages/Chat'
import './index.css'

// Protected Route component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="animate-pulse">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Public only route (redirect if logged in)
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="animate-pulse">Cargando...</div>
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={
            <PublicOnlyRoute>
              <Landing />
            </PublicOnlyRoute>
          } />
          <Route path="/login" element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          } />
          <Route path="/register" element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          } />
          <Route path="/forgot-password" element={
            <PublicOnlyRoute>
              <ForgotPassword />
            </PublicOnlyRoute>
          } />
          <Route path="/confirm-email" element={
            <PublicOnlyRoute>
              <ConfirmEmail />
            </PublicOnlyRoute>
          } />
          <Route path="/update-password" element={
            <UpdatePassword />
          } />

          {/* Chat Routes - Fullscreen, no header */}
          <Route path="/chat" element={
            <ProtectedRoute>
              <Placeholder title="Chat" />
            </ProtectedRoute>
          } />
          <Route path="/chat/:connectionId" element={
            <ProtectedRoute>
              <Placeholder title="Chat" />
            </ProtectedRoute>
          } />

          {/* Protected routes with Layout */}
          <Route element={<Layout />}>
            <Route path="/home" element={
              <ProtectedRoute>
                <Placeholder title="Inicio (Home)" />
              </ProtectedRoute>
            } />
            <Route path="/profile/:username?" element={
              <ProtectedRoute>
                <Placeholder title="Perfil" />
              </ProtectedRoute>
            } />
            <Route path="/edit-profile" element={
              <ProtectedRoute>
                <Placeholder title="Editar Perfil" />
              </ProtectedRoute>
            } />
            <Route path="/create-tierlist" element={
              <ProtectedRoute>
                <Placeholder title="Crear Tierlist" />
              </ProtectedRoute>
            } />
            <Route path="/tierlist/:id" element={
              <Placeholder title="Ver Tierlist" />
            } />
            <Route path="/edit-tierlist/:id" element={
              <ProtectedRoute>
                <Placeholder title="Editar Tierlist" />
              </ProtectedRoute>
            } />
            <Route path="/discover" element={
              <ProtectedRoute>
                <Placeholder title="Descubrir" />
              </ProtectedRoute>
            } />
            <Route path="/library/:username?" element={
              <ProtectedRoute>
                <Placeholder title="Biblioteca" />
              </ProtectedRoute>
            } />
            <Route path="/debates" element={
              <ProtectedRoute>
                <Placeholder title="Debates" />
              </ProtectedRoute>
            } />
            <Route path="/debate/:id" element={
              <ProtectedRoute>
                <Placeholder title="Ver Debate" />
              </ProtectedRoute>
            } />
            <Route path="/debates/create" element={
              <ProtectedRoute>
                <Placeholder title="Crear Debate" />
              </ProtectedRoute>
            } />

            {/* Social Discovery Routes */}
            <Route path="/connections" element={
              <ProtectedRoute>
                <Placeholder title="Conexiones" />
              </ProtectedRoute>
            } />
            <Route path="/compare/:userId" element={
              <ProtectedRoute>
                <Placeholder title="Comparar Perfiles" />
              </ProtectedRoute>
            } />

            {/* Work Page Routes */}
            <Route path="/game/:id" element={
              <ProtectedRoute>
                <Placeholder title="Página de Juego" />
              </ProtectedRoute>
            } />
            <Route path="/anime/:id" element={
              <ProtectedRoute>
                <Placeholder title="Página de Anime" />
              </ProtectedRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

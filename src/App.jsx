import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ConfirmEmail from './pages/ConfirmEmail'
import UpdatePassword from './pages/UpdatePassword'
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
          {/* Note: UpdatePassword can be accessed with an auth token from email link, so usually it's public or handles its own session logic */}
          <Route path="/update-password" element={
            <UpdatePassword />
          } />

          {/* Chat Routes - Fullscreen, no header */}
          <Route path="/chat" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />
          <Route path="/chat/:connectionId" element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          } />

          {/* Protected routes with Layout */}
          <Route element={<Layout />}>
            <Route path="/home" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/profile/:username?" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/edit-profile" element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            } />
            <Route path="/create-tierlist" element={
              <ProtectedRoute>
                <CreateTierlist />
              </ProtectedRoute>
            } />
            <Route path="/tierlist/:id" element={
              <ViewTierlist />
            } />
            <Route path="/edit-tierlist/:id" element={
              <ProtectedRoute>
                <CreateTierlist />
              </ProtectedRoute>
            } />
            <Route path="/discover" element={
              <ProtectedRoute>
                <Discover />
              </ProtectedRoute>
            } />
            <Route path="/library/:username?" element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            } />
            <Route path="/debates" element={
              <ProtectedRoute>
                <Debates />
              </ProtectedRoute>
            } />
            <Route path="/debate/:id" element={
              <ProtectedRoute>
                <ViewDebate />
              </ProtectedRoute>
            } />
            <Route path="/debates/create" element={
              <ProtectedRoute>
                <CreateDebate />
              </ProtectedRoute>
            } />

            {/* Social Discovery Routes */}
            <Route path="/connections" element={
              <ProtectedRoute>
                <Connections />
              </ProtectedRoute>
            } />
            <Route path="/compare/:userId" element={
              <ProtectedRoute>
                <CompareProfiles />
              </ProtectedRoute>
            } />

            {/* Work Page Routes */}
            <Route path="/game/:id" element={
              <ProtectedRoute>
                <WorkPage mediaType="game" />
              </ProtectedRoute>
            } />
            <Route path="/anime/:id" element={
              <ProtectedRoute>
                <WorkPage mediaType="anime" />
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

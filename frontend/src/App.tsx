import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppShell, PlainShell } from './components/AppShell'
import { RoleRoute } from './components/RoleRoute'
import { AdminPage } from './pages/AdminPage'
import { EditProfilePage } from './pages/EditProfilePage'
import { FeedPage } from './pages/FeedPage'
import { LoginPage } from './pages/LoginPage'
import { ModerationPage } from './pages/ModerationPage'
import { PostFormPage } from './pages/PostFormPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<FeedPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route element={<RoleRoute roles={['moderator', 'admin']} />}>
              <Route path="moderation" element={<ModerationPage />} />
            </Route>
            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route element={<PlainShell />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="posts/new" element={<PostFormPage />} />
            <Route path="posts/:id/edit" element={<PostFormPage />} />
            <Route path="profile/edit" element={<EditProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

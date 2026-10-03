import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    // Before entering NOC WORKSPACE GATED, directly require Google Authentication
    return <Navigate to="/auth" replace />
  }

  return children
}

export default ProtectedRoute

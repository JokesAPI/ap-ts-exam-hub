import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import './index.css'

// ── Global Error Boundary ────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-4">Please refresh the page to continue.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <App />
              <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

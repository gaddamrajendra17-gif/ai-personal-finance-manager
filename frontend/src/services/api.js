import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired - clear storage and redirect
      localStorage.removeItem('pfm-auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

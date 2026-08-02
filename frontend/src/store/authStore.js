import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const formData = new FormData()
        formData.append('username', email)
        formData.append('password', password)
        const res = await api.post('/api/auth/login', formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
        const { access_token, user } = res.data
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        set({ token: access_token, user, isAuthenticated: true })
        return user
      },

      register: async (data) => {
        const res = await api.post('/api/auth/register', data)
        const { access_token, user } = res.data
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        set({ token: access_token, user, isAuthenticated: true })
        return user
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ user: null, token: null, isAuthenticated: false })
      },

      restoreToken: () => {
        const { token } = get()
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }
      }
    }),
    {
      name: 'pfm-auth',
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated })
    }
  )
)

export default useAuthStore

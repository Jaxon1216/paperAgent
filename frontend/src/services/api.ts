import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Request failed'
    console.error('[API Error]', message)
    return Promise.reject(error)
  },
)

export default api

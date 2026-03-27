import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export function setSessionId(id: string) {
  client.defaults.headers.common['X-Session-Id'] = id
}

export default client

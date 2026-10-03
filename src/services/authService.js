/**
 * src/services/authService.js
 * Real Google Account Authentication & Live DNS Verification client.
 * Requires genuine Gmail ID and password.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1'
const API_KEY  = import.meta.env.VITE_API_KEY      ?? 'dnsx_dev_secret_key_8f3d6b2c9e1a4705'

export async function verifyGoogleAccountWithBackend(email, password) {
  if (!email || !email.trim()) {
    throw new Error('Gmail address or Google account ID is required. Input cannot be empty.')
  }

  if (!password || !password.trim()) {
    throw new Error('Password for your Google account is required.')
  }

  if (password.length < 8) {
    throw new Error('Google account passwords must be at least 8 characters long.')
  }

  const trimmedEmail = email.trim()

  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(`${API_BASE}/auth/verify-google`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: trimmedEmail, password }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const data = await res.json()

    if (!res.ok || data.status === 'error' || !data.verified) {
      const errMsg =
        data.error ||
        data.error?.message ||
        (Array.isArray(data.error?.details) ? data.error.details.map(d => d.msg).join(', ') : null) ||
        `Verification failed (HTTP ${res.status})`
      throw new Error(errMsg)
    }

    return data.user
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error('Verification timed out. Please check your network connection and try again.')
    }
    throw err
  }
}

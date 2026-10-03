/**
 * config/database.js
 * Supabase client singleton (service-role).
 *
 * Uses the service-role key so the backend bypasses Row Level Security
 * for internal reads and writes. Never expose this key to the frontend.
 */

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './env.js'
import logger from './logger.js'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    // Backend uses the service role — no user sessions needed.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application': 'dns-x-backend',
    },
  },
})

/**
 * Verify the DB connection is live. Called once on server start.
 * @returns {Promise<void>}
 */
export async function verifyDatabaseConnection() {
  try {
    const { error } = await supabase.from('system_settings').select('key').limit(1)
    if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
      if (process.env.DNS_X_SIMULATION === 'true' || process.env.NODE_ENV !== 'production') {
        logger.warn(`Database connection warning: ${error.message}. Running in simulation/in-memory mode.`)
        return
      }
      throw new Error(`Database connection failed: ${error.message}`)
    }
    logger.info('Database connected successfully')
  } catch (err) {
    if (process.env.DNS_X_SIMULATION === 'true' || process.env.NODE_ENV !== 'production') {
      logger.warn({ err: err.message }, 'Database connection could not be established. Running in simulation/in-memory mode.')
      return
    }
    throw err
  }
}

export default supabase

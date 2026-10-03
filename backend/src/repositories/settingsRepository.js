/**
 * repositories/settingsRepository.js
 * Supabase queries for the system_settings key/value store.
 */

import supabase from '../config/database.js'

/**
 * Return all settings as a plain object { key: value, … }.
 * @returns {Promise<object>}
 */
export async function getAllSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) return {}
      throw error
    }
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) return {}
    throw err
  }
}

/**
 * Upsert a single setting.
 * @param {string} key
 * @param {*} value  — stored as JSONB
 */
export async function upsertSetting(key, value) {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
      throw error
    }
  } catch (err) {
    if (err.code !== 'PGRST205' && !err.message?.includes('schema cache')) throw err
  }
}

/**
 * Upsert multiple settings in a single call.
 * @param {object} patch  — { key: value, … }
 */
export async function upsertSettings(patch) {
  try {
    const rows = Object.entries(patch).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('system_settings')
      .upsert(rows, { onConflict: 'key' })
    if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
      throw error
    }
  } catch (err) {
    if (err.code !== 'PGRST205' && !err.message?.includes('schema cache')) throw err
  }
}


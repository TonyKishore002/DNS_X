/**
 * repositories/signalRepository.js
 * Supabase queries for the signals table.
 */

import supabase from '../config/database.js'

/**
 * Insert a new signal record.
 * @param {object} signal
 * @returns {Promise<object>}
 */
export async function insertSignal(signal) {
  try {
    const { data, error } = await supabase
      .from('signals')
      .insert(signal)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { id: signal.id || `sig-${Date.now()}`, ...signal }
      }
      throw error
    }
    return data
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return { id: signal.id || `sig-${Date.now()}`, ...signal }
    }
    throw err
  }
}

/**
 * Fetch recent signals with optional filters.
 * @param {object} filters
 * @param {string} [filters.resolver_id]
 * @param {string} [filters.type]
 * @param {string} [filters.since]   — ISO timestamp lower bound
 * @param {number} [filters.limit]
 * @returns {Promise<object[]>}
 */
export async function querySignals({ resolver_id, type, since, limit = 100 } = {}) {
  try {
    let q = supabase
      .from('signals')
      .select('*')
      .order('ts', { ascending: false })
      .limit(limit)

    if (resolver_id) q = q.eq('resolver_id', resolver_id)
    if (type)        q = q.eq('type', type)
    if (since)       q = q.gte('ts', since)

    const { data, error } = await q
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return []
      }
      throw error
    }
    return data ?? []
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return []
    }
    throw err
  }
}

/**
 * Fetch signals that are candidates for correlation (recent, uncorrelated).
 * @param {string} sinceIso
 * @returns {Promise<object[]>}
 */
export async function getUncorrelatedSignals(sinceIso) {
  try {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .is('incident_id', null)
      .gte('ts', sinceIso)
      .order('ts', { ascending: true })
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return []
      }
      throw error
    }
    return data ?? []
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return []
    }
    throw err
  }
}

/**
 * Mark a set of signal IDs as belonging to an incident.
 * @param {string[]} signalIds
 * @param {string} incidentId
 */
export async function assignSignalsToIncident(signalIds, incidentId) {
  try {
    const { error } = await supabase
      .from('signals')
      .update({ incident_id: incidentId })
      .in('id', signalIds)
    if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
      throw error
    }
  } catch (err) {
    if (err.code !== 'PGRST205' && !err.message?.includes('schema cache')) {
      throw err
    }
  }
}


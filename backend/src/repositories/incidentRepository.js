/**
 * repositories/incidentRepository.js
 * Supabase queries for incidents, incident_signals, and related AI tables.
 */

import supabase from '../config/database.js'

/**
 * Insert a new incident.
 * @param {object} incident
 * @returns {Promise<object>}
 */
export async function insertIncident(incident) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .insert(incident)
      .select()
      .single()
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { id: incident.id || `inc-${Date.now()}`, ...incident }
      }
      throw error
    }
    return data
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return { id: incident.id || `inc-${Date.now()}`, ...incident }
    }
    throw err
  }
}

/**
 * Fetch incidents with optional status/severity filters.
 * @param {object} filters
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function queryIncidents({ status, severity, limit = 50, offset = 0 } = {}) {
  try {
    let q = supabase
      .from('incidents')
      .select('*, incident_signals(signal_id)', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)   q = q.eq('status', status)
    if (severity) q = q.eq('severity', severity)

    const { data, count, error } = await q
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { data: [], total: 0 }
      }
      throw error
    }
    return { data: data ?? [], total: count ?? 0 }
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return { data: [], total: 0 }
    }
    throw err
  }
}

/**
 * Fetch a single incident with its related signals and AI assessment.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getIncidentById(id) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select(`
        *,
        incident_signals ( signal_id, signals(*) ),
        ai_assessments (*),
        ai_explanations (*),
        ai_recommendations (*)
      `)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return null
      }
      throw error
    }
    return data
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return null
    }
    throw err
  }
}

/**
 * Update incident fields (status, resolved_at, etc.).
 * @param {string} id
 * @param {object} patch
 * @returns {Promise<object|null>}
 */
export async function updateIncident(id, patch) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
        return { id, ...patch, updated_at: new Date().toISOString() }
      }
      throw error
    }
    return data
  } catch (err) {
    if (err.code === 'PGRST205' || err.message?.includes('schema cache')) {
      return { id, ...patch, updated_at: new Date().toISOString() }
    }
    throw err
  }
}

/**
 * Fetch only non-resolved incidents (used for active-incident count).
 * @returns {Promise<object[]>}
 */
export async function getActiveIncidents() {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select('id, title, severity, status, started_at')
      .not('status', 'in', '("resolved","acknowledged")')
      .order('started_at', { ascending: false })
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
 * Insert rows into the incident_signals join table.
 * @param {string} incidentId
 * @param {string[]} signalIds
 */
export async function linkSignalsToIncident(incidentId, signalIds) {
  try {
    const rows = signalIds.map((signal_id) => ({ incident_id: incidentId, signal_id }))
    const { error } = await supabase.from('incident_signals').insert(rows)
    if (error && error.code !== 'PGRST205' && !error.message?.includes('schema cache')) {
      throw error
    }
  } catch (err) {
    if (err.code !== 'PGRST205' && !err.message?.includes('schema cache')) {
      throw err
    }
  }
}


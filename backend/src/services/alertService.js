/**
 * services/alertService.js
 * Outbound alert integration management.
 * Full delivery logic (webhook dispatch, PagerDuty, email) in Step 9.
 */

import supabase from '../config/database.js'

export async function listIntegrations() {
  const { data, error } = await supabase
    .from('alert_integrations')
    .select('id, type, enabled, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createIntegration({ type, config, enabled = true }) {
  const { data, error } = await supabase
    .from('alert_integrations')
    .insert({ type, config, enabled })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateIntegration(id, patch) {
  const { data, error } = await supabase
    .from('alert_integrations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteIntegration(id) {
  const { error } = await supabase
    .from('alert_integrations')
    .delete()
    .eq('id', id)
  if (error) throw error
}

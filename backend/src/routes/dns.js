/**
 * routes/dns.js
 * Real DNS Target Measurement and Probing Routes.
 */

import { Router } from 'express'
import {
  measureDomain,
  setActiveTargetDomain,
  clearActiveTargetDomain,
  getActiveTargetDomain,
} from '../services/dnsMeasurementService.js'
import { getRecentMeasurements } from '../repositories/dnsMeasurementRepository.js'
import { success, errors } from '../utils/response.js'
import logger from '../config/logger.js'

const DOMAIN_FORMAT_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') return null
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]
  if (!DOMAIN_FORMAT_REGEX.test(clean)) return null
  return clean
}

const router = Router()

/**
 * POST /api/v1/dns/probe
 * Probe a domain in real-time using dnspython and return verified measurements.
 * Body: { domain: string }
 */
router.post('/dns/probe', async (req, res, next) => {
  try {
    const rawDomain = req.body?.domain || req.query?.domain
    const cleanDomain = validateDomain(rawDomain)
    if (!cleanDomain) {
      return errors.badRequest(res, 'Invalid domain format: must be a valid FQDN (e.g. example.com)')
    }

    const measurement = await measureDomain(cleanDomain)
    return success(res, measurement)
  } catch (err) {
    logger.error({ err: err.message }, 'Failed handling /dns/probe')
    next(err)
  }
})

/**
 * GET /api/v1/dns/probe?domain=...
 */
router.get('/dns/probe', async (req, res, next) => {
  try {
    const domain = req.query?.domain
    if (!domain || typeof domain !== 'string') {
      return errors.badRequest(res, 'domain query parameter is required')
    }

    const measurement = await measureDomain(domain)
    return success(res, measurement)
  } catch (err) {
    logger.error({ err: err.message }, 'Failed handling GET /dns/probe')
    next(err)
  }
})

/**
 * POST /api/v1/dns/target
 * Set active target for continuous backend probing and WebSocket broadcast.
 * Body: { domain: string }
 */
router.post('/dns/target', async (req, res, next) => {
  try {
    const rawDomain = req.body?.domain
    const cleanDomain = validateDomain(rawDomain)
    if (!cleanDomain) {
      return errors.badRequest(res, 'Invalid domain format: must be a valid FQDN (e.g. example.com)')
    }

    await setActiveTargetDomain(cleanDomain)
    return success(res, { activeTarget: cleanDomain, monitoring: true })
  } catch (err) {
    next(err)
  }
})

/**
 * DELETE /api/v1/dns/target
 * Stop active target probing.
 */
router.delete('/dns/target', (_req, res) => {
  clearActiveTargetDomain()
  return success(res, { activeTarget: null, monitoring: false })
})

/**
 * GET /api/v1/dns/target
 * Get currently active target domain.
 */
router.get('/dns/target', (_req, res) => {
  return success(res, { activeTarget: getActiveTargetDomain() })
})

/**
 * GET /api/v1/dns/measurements?domain=...
 * Retrieve recent real observations.
 */
router.get('/dns/measurements', async (req, res, next) => {
  try {
    const domain = req.query?.domain
    const limit = parseInt(req.query?.limit, 10) || 30
    const records = await getRecentMeasurements(domain, limit)
    return success(res, records)
  } catch (err) {
    next(err)
  }
})

export default router

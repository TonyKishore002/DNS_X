/**
 * dns_probe.test.js
 * Verification test suite for Real DNS Measurement Pipeline
 */

import request from 'supertest'
import { createApp } from '../app.js'
import { clearActiveTargetDomain } from '../services/dnsMeasurementService.js'
import { API_KEY } from '../config/env.js'

describe('DNS_X Real DNS Probe Pipeline Tests', () => {
  let app

  beforeAll(() => {
    app = createApp()
  })

  afterAll(() => {
    clearActiveTargetDomain()
  })

  it('rejects invalid domain format with 400 BAD_REQUEST', async () => {
    const res = await request(app)
      .post('/api/v1/dns/probe')
      .set('X-Api-Key', API_KEY)
      .send({ domain: 'invalid domain with spaces @@#' })

    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('performs real DNS probe on a valid domain', async () => {
    const res = await request(app)
      .post('/api/v1/dns/probe')
      .set('X-Api-Key', API_KEY)
      .send({ domain: 'cloudflare.com' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.target).toHaveProperty('domain', 'cloudflare.com')
    expect(res.body.data.target).toHaveProperty('records')
    expect(res.body.data.target).toHaveProperty('vantagePoints')
    expect(res.body.data.target).toHaveProperty('authoritative')
    expect(res.body.data.errors).toHaveProperty('dominant')
    expect(res.body.data.performance).toHaveProperty('latency')
    expect(res.body.data.traffic).toHaveProperty('isPublicDomain', true)
    expect(res.body.data.traffic.qps).toBeNull()
  }, 15000)

  it('handles NXDOMAIN for non-existent domain gracefully', async () => {
    const res = await request(app)
      .post('/api/v1/dns/probe')
      .set('X-Api-Key', API_KEY)
      .send({ domain: 'non-existent-test-domain-dnsx-9999.xyz' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.target).toHaveProperty('domain', 'non-existent-test-domain-dnsx-9999.xyz')
    expect(['NXDOMAIN', 'SERVFAIL', 'ERROR']).toContain(res.body.data.errors.dominant)
  }, 20000)

  it('manages active target lifecycle via /dns/target', async () => {
    const setRes = await request(app)
      .post('/api/v1/dns/target')
      .set('X-Api-Key', API_KEY)
      .send({ domain: 'google.com' })

    expect(setRes.status).toBe(200)
    expect(setRes.body.ok).toBe(true)
    expect(setRes.body.data.activeTarget).toBe('google.com')

    const clearRes = await request(app)
      .delete('/api/v1/dns/target')
      .set('X-Api-Key', API_KEY)

    expect(clearRes.status).toBe(200)
    expect(clearRes.body.ok).toBe(true)
    expect(clearRes.body.data.activeTarget).toBeNull()
  }, 20000)
})

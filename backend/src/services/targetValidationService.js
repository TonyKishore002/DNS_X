/**
 * services/targetValidationService.js
 *
 * Strict Backend-side Real Website Validation Engine for DNS_X.
 * Validates domain syntax, real DNS resolution, and HTTP/HTTPS reachability.
 */

import { promises as dnsPromises } from 'node:dns'
import logger from '../config/logger.js'

const DOMAIN_FORMAT_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

/**
 * Safely normalize input URL/domain to a clean hostname.
 * Handles https://..., http://..., ports, query parameters, hashes, and trailing slashes.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeTargetInput(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let cleaned = raw.trim().toLowerCase()
  cleaned = cleaned.replace(/^https?:\/\//i, '')
  cleaned = cleaned.split('/')[0]
  cleaned = cleaned.split('?')[0]
  cleaned = cleaned.split('#')[0]
  cleaned = cleaned.split(':')[0]
  return cleaned.replace(/\.$/, '')
}

/**
 * Perform real DNS lookup for A or AAAA records.
 */
async function checkDnsResolution(domain) {
  try {
    const aRecords = await dnsPromises.resolve4(domain)
    if (aRecords && aRecords.length > 0) {
      return { ok: true, addresses: aRecords }
    }
  } catch (err4) {
    try {
      const aaaaRecords = await dnsPromises.resolve6(domain)
      if (aaaaRecords && aaaaRecords.length > 0) {
        return { ok: true, addresses: aaaaRecords }
      }
    } catch (err6) {
      const code = err4.code || err6.code || 'ENOTFOUND'
      return { ok: false, errorType: code === 'ENOTFOUND' ? 'NXDOMAIN' : 'DNS_FAILURE', code }
    }
  }
  return { ok: false, errorType: 'NXDOMAIN', code: 'ENOTFOUND' }
}

/**
 * Perform HTTP or HTTPS reachability probe following safe redirects.
 * Server status codes (200, 301, 302, 403, 404, 500, etc.) are valid responses.
 */
async function checkProtocolReachability(protocol, domain, timeoutMs = 9000) {
  const url = `${protocol}://${domain}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'DNS_X-TargetValidator/1.0',
        'Accept': '*/*',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    // Any HTTP status response (200, 301, 302, 403, 404, 500, 502, 503, etc.) means the server responded!
    return {
      reachable: true,
      status: response.status,
      statusText: response.statusText,
      protocol,
      url: response.url,
    }
  } catch (err) {
    const errMsg = err.message || ''
    const errCode = err.code || err.cause?.code || ''
    const name = err.name || ''

    if (name === 'AbortError' || errCode === 'ETIMEOUT' || errMsg.includes('timeout')) {
      return { reachable: false, errorType: 'TIMEOUT', details: 'HTTP connection timed out' }
    }
    if (errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || errCode === 'EHOSTUNREACH') {
      return { reachable: false, errorType: 'CONNECTION_FAILURE', details: `Connection refused (${errCode})` }
    }
    if (errCode === 'ENOTFOUND') {
      return { reachable: false, errorType: 'NXDOMAIN', details: 'Hostname could not be resolved by DNS' }
    }
    if (errCode.startsWith('ERR_TLS_') || errCode.startsWith('DEPTH_ZERO') || errMsg.includes('certificate')) {
      // TLS certificate issue means the remote web server answered the TLS handshake!
      return { reachable: true, status: 495, statusText: 'TLS Certificate Issue', protocol, url }
    }

    return { reachable: false, errorType: 'CONNECTION_FAILURE', details: errMsg || errCode || 'Connection failed' }
  }
}

/**
 * Validate target domain backend-side.
 * Chain: Syntax -> DNS Resolution -> HTTP/HTTPS Reachability.
 *
 * @param {string} rawTarget
 * @returns {Promise<object>}
 */
export async function validateTargetBackend(rawTarget) {
  const cleanDomain = normalizeTargetInput(rawTarget)

  // 1. Syntax Validation
  if (!cleanDomain || !DOMAIN_FORMAT_REGEX.test(cleanDomain) || cleanDomain.length > 253) {
    const message = `Invalid target format "${rawTarget || ''}". Please enter a valid fully qualified domain name or URL (e.g. https://example.com or google.com).`
    return {
      valid: false,
      target: rawTarget || '',
      domain: cleanDomain || rawTarget || '',
      reason: 'SYNTAX_INVALID',
      message,
      error: message,
      details: 'Invalid domain hostname syntax format.',
    }
  }

  // 2. Real DNS Resolution
  const dnsResult = await checkDnsResolution(cleanDomain)
  if (!dnsResult.ok) {
    const reason = dnsResult.errorType || 'NXDOMAIN'
    const message = reason === 'NXDOMAIN'
      ? `DNS resolution failed (NXDOMAIN): Target domain "${cleanDomain}" does not exist.`
      : `DNS resolution failed (${dnsResult.code}): Domain "${cleanDomain}" has no address records.`

    logger.warn({ domain: cleanDomain, dnsCode: dnsResult.code, reason }, 'Target validation failed: DNS resolution failure')
    return {
      valid: false,
      target: rawTarget,
      domain: cleanDomain,
      reason,
      message,
      error: message,
      details: `Authoritative DNS resolution returned ${dnsResult.code}.`,
    }
  }

  // 3. HTTP / HTTPS Reachability Check (Follow redirects; 200, 301, 302, 403, 404, 500 are valid)
  let httpResult = await checkProtocolReachability('https', cleanDomain, 9000)
  if (!httpResult.reachable) {
    const httpFallback = await checkProtocolReachability('http', cleanDomain, 9000)
    if (httpFallback.reachable) {
      httpResult = httpFallback
    }
  }

  if (!httpResult.reachable) {
    const reason = httpResult.errorType || 'CONNECTION_FAILURE'
    const message = reason === 'TIMEOUT'
      ? `HTTP/HTTPS request timed out: Web server at "${cleanDomain}" failed to respond within 6 seconds.`
      : `Connection failed: Web server at "${cleanDomain}" is unreachable over HTTP/HTTPS.`

    logger.warn({ domain: cleanDomain, reason, details: httpResult.details }, 'Target validation failed: Website unreachable')
    return {
      valid: false,
      target: rawTarget,
      domain: cleanDomain,
      reason,
      message,
      error: message,
      details: `HTTP reachability failed (${reason}): ${httpResult.details}`,
    }
  }

  // Target successfully validated as a real, reachable website
  logger.info(
    { domain: cleanDomain, ips: dnsResult.addresses, status: httpResult.status, protocol: httpResult.protocol },
    'Target backend validation passed'
  )

  return {
    valid: true,
    target: rawTarget,
    cleanDomain,
    domain: cleanDomain,
    ips: dnsResult.addresses,
    httpStatus: httpResult.status,
    protocol: httpResult.protocol,
    message: `Website verified reachable via ${httpResult.protocol.toUpperCase()} (Status ${httpResult.status}).`,
    details: `Target "${cleanDomain}" resolved to ${dnsResult.addresses.join(', ')} and responded to HTTP/HTTPS request with status ${httpResult.status}.`,
  }
}

export default {
  normalizeTargetInput,
  validateTargetBackend,
}

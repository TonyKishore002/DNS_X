/**
 * routes/auth.js
 * Real Google Account Authentication & Verification endpoint.
 * Requires genuine Gmail ID and password.
 * POST /api/v1/auth/verify-google
 */

import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validation.js'
import { verifyGoogleAccount } from '../utils/googleAuthVerifier.js'

const router = Router()

router.post(
  '/auth/verify-google',
  [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Gmail ID or Google account email is required')
      .isEmail()
      .withMessage('A valid Gmail address is required'),
    body('password')
      .notEmpty()
      .withMessage('Password of the Google account is required')
      .isLength({ min: 8 })
      .withMessage('Google passwords must be at least 8 characters long'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body
      const result = await verifyGoogleAccount(email, password)

      if (!result.verified) {
        return res.status(400).json({
          status: 'error',
          verified: false,
          error: result.error,
        })
      }

      return res.status(200).json({
        status: 'success',
        verified: true,
        user: {
          id: `usr_g_${Buffer.from(result.email).toString('hex').slice(0, 12)}`,
          email: result.email,
          name: result.username,
          role: result.accountType === 'workspace' ? 'Enterprise Security Engineer' : 'Lead NOC Engineer',
          provider: 'google',
          accountType: result.accountType,
          domain: result.domain,
          verifiedAt: result.verifiedAt,
        },
      })
    } catch (err) {
      next(err)
    }
  }
)

export default router

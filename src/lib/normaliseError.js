/**
 * normaliseError — shared Unipile error normaliser
 *
 * Converts any error thrown by the Unipile SDK or fetch calls into a
 * structured object with consistent fields, regardless of the error shape.
 *
 * @param {unknown} err - The raw error from a Unipile API call
 * @returns {{ code: string, message: string, retryable: boolean, httpStatus: number }}
 */
export function normaliseError(err) {
  // Default values
  let code = 'API_ERROR'
  let message = 'An unexpected error occurred'
  let retryable = false
  let httpStatus = 0

  if (!err) {
    return { code, message, retryable, httpStatus }
  }

  // Extract HTTP status from various error shapes
  const status =
    err?.response?.status ??
    err?.status ??
    err?.statusCode ??
    0

  httpStatus = typeof status === 'number' ? status : 0

  // Try to extract body from various shapes
  let body = null
  try {
    if (err?.response?.data && typeof err.response.data === 'object') {
      body = err.response.data
    } else if (err?.body && typeof err.body === 'object') {
      body = err.body
    } else if (typeof err?.response?.data === 'string') {
      body = JSON.parse(err.response.data)
    }
  } catch {
    // body remains null — plain text or malformed JSON
  }

  // Derive code
  if (body?.code && typeof body.code === 'string') {
    code = body.code
  } else if (httpStatus === 404) {
    code = 'NOT_FOUND'
  } else if (httpStatus === 401 || httpStatus === 403) {
    code = 'UNAUTHORIZED'
  } else if (httpStatus === 429) {
    code = 'RATE_LIMITED'
  } else if (httpStatus >= 500) {
    code = 'SERVER_ERROR'
  } else if (httpStatus === 0) {
    code = 'NETWORK_ERROR'
  }

  // Derive message
  const rawMessage =
    body?.message ??
    body?.error ??
    body?.detail ??
    err?.message ??
    null

  if (rawMessage && typeof rawMessage === 'string' && rawMessage.trim() !== '') {
    message = rawMessage
  } else if (httpStatus === 401 || httpStatus === 403) {
    message = 'Check your Unipile credentials in Settings.'
  } else if (httpStatus === 404) {
    message = 'The requested resource was not found.'
  } else if (httpStatus === 429) {
    message = 'Rate limit reached. Please wait before retrying.'
  } else if (httpStatus >= 500) {
    message = 'Service temporarily unavailable. Please try again later.'
  } else if (httpStatus === 0) {
    message = 'Connection failed. Check your internet connection.'
  }

  // Retryable: network errors and 5xx are retryable; 4xx are not
  retryable = httpStatus === 0 || httpStatus >= 500

  return { code, message, retryable, httpStatus }
}

/**
 * getToastMessage — returns the user-facing toast message for a normalised error.
 * Callers can use this to show consistent toast notifications.
 *
 * @param {{ code: string, message: string, httpStatus: number }} normalisedError
 * @returns {string}
 */
export function getToastMessage(normalisedError) {
  const { code, message, httpStatus } = normalisedError

  if (httpStatus === 401 || httpStatus === 403) {
    return 'Check your Unipile credentials in Settings.'
  }
  if (httpStatus === 429) {
    return 'Rate limit reached, retrying shortly…'
  }
  if (httpStatus >= 500) {
    return 'Service temporarily unavailable. Please try again.'
  }
  if (httpStatus === 0) {
    return 'Connection failed. Check your internet connection.'
  }
  if (code === 'INMAIL_INSUFFICIENT_CREDITS') {
    return 'Insufficient InMail credits for this account.'
  }
  if (code === 'TIER_NOT_AVAILABLE') {
    return 'This LinkedIn tier (Sales Navigator / Recruiter) is not available for this account.'
  }

  return message
}

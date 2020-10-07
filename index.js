const needle = require('needle')
const qs = require('querystring')

module.exports = class TokenManager {
  /**
   * IAM Token Manager Service
   *
   * Retreives, stores, and refreshes IAM tokens.
   *
   * @param {Object} options
   * @param {String} options.iamApikey
   * @param {String} options.iamUrl - url of the iam api to retrieve tokens from
   * @constructor
   */
  constructor (options) {
    this.tokenInfo = {}

    // while a token is being loaded, this promise will be defined, yet unsettled
    this.tokenLoadingPromise = undefined

    this.iamUrl = options.iamUrl || 'https://iam.cloud.ibm.com/identity/token'
    if (options.iamApikey) {
      this.iamApikey = options.iamApikey
    } else {
      throw new Error(`Missing iamApikey parameter.`)
    }
  }
  /**
   * This function sends an access token back through a Promise. The source of the token
   * is determined by the following logic:
   * 1. If the token is expired (that is, we already have one, but it is no longer valid, or about to time out), we
   *    load a new one
   * 2. If the token is not expired, we obviously have a valid token, so just resolve with it's value
   * 3. If we haven't got a token at all, but a loading is already in process, we wait for the loading promise to settle
   *    and depending on the result
   *    3a) use the newly returned and cached token
   *    3b) in case of error, trigger a fresh loading attempt
   * 4. If there is no token available and also no loading in progress, trigger the token loading
   *
   * @returns {Promise} - resolved with token value
   */
  getToken () {
    return new Promise((resolve, reject) => {
      const loadToken = () => {
        this.loadToken()
          .then(() => {
            resolve(this.tokenInfo.access_token)
          })
          .catch(error => reject(error))
      }

      if (this.isTokenExpired()) {
        // 1. load a new token
        loadToken()
      } else if (this.tokenInfo.access_token) {
        // 2. return the cached valid token
        resolve(this.tokenInfo.access_token)
      } else if (this.tokenLoadingPromise) {
        // 3. a token loading operation is already running
        this.tokenLoadingPromise
          .then(() => {
            // 3a) it was successful, so return the fresh token
            resolve(this.tokenInfo.access_token)
          })
          .catch(() => {
            // 3b) give it one more try - obviously, we hoped for a Promise triggered by another invocation to
            // return the token for us, but it didn't work out. So we need to trigger another attempt.
            loadToken()
          })
      } else {
        // 4. just trigger the token loading
        loadToken()
      }
    })
  }
  /**
   * This function returns the Authorization header value including the token
   * @returns {Promise}
   */
  getAuthHeader () {
    return this.getToken().then(token => {
      return `Bearer ${token}`
    })
  }
  /**
   * Triggers the remote IAM API token call, saves the response and resolves the loading promise
   * with the access_token
   *
   * @returns {Promise}
   */
  loadToken () {
    // reset buffered tokenInfo, as we're about to load a new token
    this.tokenInfo = {}

    // let other callers know that we're currently loading a new token
    this.tokenLoadingPromise = this.requestToken().then(tokenResponse => {
      this.saveTokenInfo(tokenResponse)
      return this.tokenInfo.access_token
    })

    return this.tokenLoadingPromise
  }
  /**
   * Request an IAM token using an API key and IAM URL.
   *
   * @private
   * @returns {Promise}
   */
  requestToken () {
    let options = {
      url: this.iamUrl,
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic Yng6Yng='
      },
      form: {
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: this.iamApikey
      }
    }
    return this.sendRequest(options)
  }
  /**
   * Refresh an IAM token using a refresh token.
   *
   * @private
   * @returns {Promise}
   */
  refreshToken () {
    let options = {
      url: this.iamUrl,
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic Yng6Yng='
      },
      form: {
        grant_type: 'refresh_token',
        refresh_token: this.tokenInfo.refresh_token
      }
    }
    return this.sendRequest(options)
  }
  /**
   * Check if currently stored token is expired.
   *
   * Using a buffer to prevent the edge case of the
   * token expiring before the request could be made.
   *
   * The buffer will be a fraction of the total TTL. Using 80%.
   *
   * @private
   * @returns {boolean}
   */
  isTokenExpired () {
    // the token cannot be considered expired, if we don't have one (yet)
    if (!this.tokenInfo || !this.tokenInfo.access_token) {
      return false
    }

    if (!this.tokenInfo.expires_in || !this.tokenInfo.expiration) {
      return true
    }
    var fractionOfTtl = 0.8
    var timeToLive = this.tokenInfo.expires_in
    var expireTime = this.tokenInfo.expiration
    var currentTime = Math.floor(Date.now() / 1000)
    var refreshTime = expireTime - (timeToLive * (1.0 - fractionOfTtl))
    return refreshTime < currentTime
  }
  /**
   * Used as a fail-safe to prevent the condition of a refresh token expiring,
   * which could happen after around 30 days. This function will return true
   * if it has been at least 7 days and 1 hour since the last token was
   * retrieved.
   *
   * @private
   * @returns {boolean}
   */
  isRefreshTokenExpired () {
    if (!this.tokenInfo.expiration) {
      return true
    }
    var sevenDays = 7 * 24 * 3600
    var currentTime = Math.floor(Date.now() / 1000)
    var newTokenTime = this.tokenInfo.expiration + sevenDays
    return newTokenTime < currentTime
  }
  /**
   * Save the response from the IAM service request to the object's state.
   *
   * @param {IamTokenData} tokenResponse - Response object from IAM service request
   * @private
   * @returns {void}
   */
  saveTokenInfo (tokenResponse) {
    this.tokenInfo = tokenResponse
  }
  /**
   * Creates the request.
   * @param options - method, url, form
   * @private
   * @returns {Promise}
   */
  sendRequest (options) {
    return needle(options.method.toLowerCase(),
      options.url,
      options.body || qs.stringify(options.form),
      options)
      .then(resp => {
        if (resp.statusCode >= 400) {
          // we turn >=400 statusCode responses into exceptions
          const error = new Error(resp.body.error || resp.statusMessage)
          error.statusCode = resp.statusCode // the http status code
          error.error = resp.body // the error body
          error.options = options
          if (typeof error.error === 'object') {
            error.error.error = error.error.errorMessage
          }
          return Promise.reject(error)
        } else {
          // otherwise, the response body is the expected return value
          return resp.body
        }
      })
  }
}

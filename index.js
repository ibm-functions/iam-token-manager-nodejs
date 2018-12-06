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
    this.iamUrl = options.iamUrl || 'https://iam.bluemix.net/identity/token'
    if (options.iamApikey) {
      this.iamApikey = options.iamApikey
    } else {
      throw new Error(`Missing iamApikey parameter.`)
    }
  }
  /**
   * This function sends an access token back through a Promise. The source of the token
   * is determined by the following logic:
   * 1. If this class is managing tokens and does not yet have one, make a request for one
   * 2. If this class is managing tokens and the token has expired, refresh it
   * 3. If this class is managing tokens and has a valid token stored, send it
   *
   * @returns {Promise} - resolved with token value
   */
  getToken () {
    return new Promise((resolve, reject) => {
      if (!this.tokenInfo.access_token || this.isRefreshTokenExpired()) {
        // 1. request an initial token
        return this.requestToken().then(tokenResponse => {
          this.saveTokenInfo(tokenResponse)
          resolve(this.tokenInfo.access_token)
        }).catch(error => reject(error))
      } else if (this.isTokenExpired()) {
        // 2. refresh a token
        return this.refreshToken().then(tokenResponse => {
          this.saveTokenInfo(tokenResponse)
          resolve(this.tokenInfo.access_token)
        }).catch(error => reject(error))
      } else {
        // 3. use valid managed token
        resolve(this.tokenInfo.access_token)
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

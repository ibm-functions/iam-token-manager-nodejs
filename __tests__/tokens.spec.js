const needle = require('needle')
const TokenManager = require('../')
const tm = new TokenManager({ iamApikey: '12345' })
const validToken = {
  body: {
    access_token: 'myaccesstoken',
    refresh_token: 'refreshtoken',
    expiration: 1533674057,
    expires_in: 3600
  }
}

jest.mock('needle')
test('should fetch token', () => {
  needle.mockResolvedValue(Promise.resolve(validToken))
  return tm.getToken().then(t => expect(t).toEqual(validToken.body.access_token))
})
test('should fetch auth header', () => {
  needle.mockResolvedValue(Promise.resolve(validToken))
  return tm.getAuthHeader().then(h => expect(h).toEqual(`Bearer ${validToken.body.access_token}`))
})

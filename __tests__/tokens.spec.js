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
test('should call requestToken() only once with many parallel getAuthHeader() calls', () => {
  needle.mockResolvedValue(Promise.resolve(validToken))
  const spy = jest.spyOn(tm, 'requestToken')
  const spy2 = jest.spyOn(tm, 'getToken')

  const proms = []
  for (let i = 0; i < 10; i++) {
    proms.push(tm.getAuthHeader().then(h => expect(h).toEqual(`Bearer ${validToken.body.access_token}`)))
  }
  return Promise.all(proms)
    .then(() => {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(10)
      spy.mockRestore()
      spy2.mockRestore()
    })
})

test('should call requestToken() only once with many parallel getAuthHeader() calls', () => {
  needle.mockResolvedValue(Promise.resolve(validToken))
  const spy = jest.spyOn(tm, 'requestToken')
  const spy2 = jest.spyOn(tm, 'getToken')

  const proms = []
  for (let i = 0; i < 10; i++) {
    proms.push(tm.getAuthHeader().then(h => expect(h).toEqual(`Bearer ${validToken.body.access_token}`)))
  }
  return Promise.all(proms)
    .then(() => {
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(10)
      spy.mockRestore()
      spy2.mockRestore()
    })
})

test('should properly reject on failing getAuthHeader() calls', () => {
  needle.mockResolvedValue(Promise.reject(new Error('Too Many Requests')))
  const spy = jest.spyOn(tm, 'requestToken')
  const spy2 = jest.spyOn(tm, 'getToken')

  const proms = []

  for (let i = 0; i < 100; i++) {
    proms.push(tm.getAuthHeader()
      .catch((error) => {
        expect(error).toEqual(new Error('Too Many Requests'))
      }))
  }

  return Promise.all(proms)
    .then(() => {
      expect(spy).toHaveBeenCalledTimes(100)
      expect(spy2).toHaveBeenCalledTimes(100)
      spy.mockRestore()
      spy2.mockRestore()
    })
})

test('should properly reject on failing getAuthHeader() calls in different TokenManager instances', () => {
  needle.mockResolvedValue(Promise.reject(new Error('Too Many Requests')))
  const proms = []

  for (let i = 0; i < 100; i++) {
    const _tm = new TokenManager({ iamApikey: '12345' })
    proms.push(_tm.getAuthHeader()
      .catch((error) => {
        expect(error).toEqual(new Error('Too Many Requests'))
      }))
  }

  return Promise.all(proms)
})

jest.setTimeout(120000)

test('should properly timeout on network slowness', () => {
  needle.mockResolvedValue(new Promise((resolve) => {
    setTimeout(() => { resolve(validToken) }, 100000).unref() // current limit is 90000 for the Promise timeout
  }))
  return tm.getAuthHeader()
    .then(() => {
      jest.fail('Got response, but expected an Error')
    })
    .catch(err => {
      expect(err).toEqual(new Error('Promise timed out after 90000 milliseconds.'))
    })
})

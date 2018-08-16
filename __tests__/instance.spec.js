const TokenManager = require('../')
const tm = new TokenManager({ iamApikey: '12345' })
test('it should create a token manager instance', () => {
  expect(tm).toBeDefined()
})
test('it should have a getToken function', () => {
  expect(tm.getToken).toBeDefined()
  expect(tm.getAuthHeader).toBeDefined()
})
test('it should have a getAuthHeader function', () => {
  expect(tm.getAuthHeader).toBeDefined()
})
test('the getToken fails with an error', () => {
  expect.assertions(1)
  return expect(tm.getToken()).rejects.toHaveProperty('error')
})
test('the getAuthHeader fails with an error', () => {
  expect.assertions(1)
  return expect(tm.getAuthHeader()).rejects.toHaveProperty('error')
})

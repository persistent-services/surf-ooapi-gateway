const httpcode = require('../../lib/httpcode')
const authentication = require('./authentication')
const authorization = require('./authorization')
const credentials = require('./credentials')

const realm =
      process.env.SURFNET_OOAPI_GW_CLIENT_REALM ||
      'SURFnet OOAPI Gateway client access'

function assertAllEndpointsDefined ({ acls }, { gatewayConfig: { serviceEndpoints } }) {
  const available = Object.keys(serviceEndpoints)
  const required = Object.keys(
    acls.reduce((m, { endpoints }) =>
      endpoints.reduce((m, { endpoint }) => {
        m[endpoint] = true
        return m
      }, m), {})
  )

  required.forEach(endpoint => {
    if (!available.includes(endpoint)) {
      throw new Error(`required service endpoint '${endpoint}' not configured`)
    }
  })
}

module.exports = (params, config) => {
  assertAllEndpointsDefined(params, config)
  const acls = authorization.compileAcls(params.acls)

  return (req, res, next) => {
    const app = authentication.appFromRequest(req, credentials.read(params.credentials))
    delete req.headers.authorization

    if (app) {
      if (authorization.isAuthorized(app, acls, req)) {
        next()
      } else {
        res.sendStatus(httpcode.Forbidden)
      }
    } else {
      res.set({ 'WWW-Authenticate': `Basic realm="${realm}"` })
      res.sendStatus(httpcode.Unauthorized)
    }
  }
}

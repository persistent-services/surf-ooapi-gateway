/* Copyright (C) 2020 SURFnet B.V.
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see http://www.gnu.org/licenses/.
 */

const logger = require('express-gateway/lib/logger').createLoggerWithLabel('[OAGW:Gatekeeper]')

const httpcode = require('../../lib/httpcode')
const xroute = require('../../lib/xroute')
const authentication = require('./authentication')
const authorization = require('./authorization')

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
  logger.info('initializing gatekeeper policy')

  assertAllEndpointsDefined(params, config)
  const acls = authorization.compileAcls(params.acls)
  logger.debug(`known apps: ${Object.keys(acls)}`)

  return (req, res, next) => {
    const app = authentication.appFromRequest(req, params.apps)
    req.egContext.app = app
    delete req.headers.authorization

    if (app) {
      const acl = acls[app]

      if (acl) {
        authorization.prepareRequestHeaders(acl, req)
        try {
          if (authorization.isAuthorized(acl, req)) {
            next()
            return
          }
        } catch (e) {
          if (e instanceof xroute.MalformedHeader) {
            res.sendStatus(httpcode.BadRequest)
            return
          } else {
            throw e
          }
        }
      }

      res.sendStatus(httpcode.Forbidden)
    } else {
      res.set({ 'WWW-Authenticate': `Basic realm="${realm}"` })
      res.sendStatus(httpcode.Unauthorized)
    }
  }
}

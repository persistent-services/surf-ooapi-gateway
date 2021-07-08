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

const httpProxy = require('http-proxy')

const logger = require('express-gateway/lib/logger').createLoggerWithLabel('[OAGW:Aggregation]')
const jsonLog = require('../../lib/json_log')

const httpcode = require('../../lib/httpcode')
const xroute = require('../../lib/xroute')
const envelop = require('./envelop')
const { proxyOptionsForEndpoint } = require('./proxy-extras')
const { keepHeadersFilter } = require('./keep-headers')

module.exports = (config, { gatewayConfig: { serviceEndpoints } }) => {
  logger.info(`initializing aggregation policy for ${Object.keys(serviceEndpoints)}`)

  // Note: can not require db earlier because EG configuration might
  // not be fully loaded yet causing a deadlock.
  const db = require('express-gateway/lib/db')

  const isEnvelopRequest = (req) => {
    if (config.noEnvelopIfAnyHeaders) {
      for (const header in config.noEnvelopIfAnyHeaders) {
        if (req.headers[header.toLowerCase()] === config.noEnvelopIfAnyHeaders[header]) {
          return false
        }
      }
    }
    return true
  }

  const keepRequestHeaders = keepHeadersFilter(config.keepRequestHeaders)
  const keepResponseHeaders = keepHeadersFilter(config.keepResponseHeaders)

  return (req, res, next) => {
    const envelopRequest = isEnvelopRequest(req)
    const endpoints = xroute.decode(req.headers['x-route'])
    const requestId = req.egContext.requestID
    if (!endpoints) {
      throw new Error('no endpoints selected, make sure gatekeeper policy configured')
    }

    if (endpoints.length > 1 && !envelopRequest) {
      res.sendStatus(httpcode.BadRequest)
      return
    }

    if (config.keepRequestHeaders) {
      keepRequestHeaders(req.headers)
    }

    const responses = []
    const endpointDone = (endpoint, proxyRes) => {
      if (res.writableEnded) return
      responses.push([endpoint, proxyRes])

      if (responses.length === endpoints.length) {
        res.status(httpcode.OK)
        res.send(envelop.packageResponses(req, responses))
      }
    }

    endpoints.forEach(async (endpointId) => {
      if (res.writableEnded) return

      try {
        const endpoint = {
          ...serviceEndpoints[endpointId],
          id: endpointId
        }
        const proxy = httpProxy.createProxyServer()
        let reqTimerStart = -1
        // setup logging
        proxy.on('proxyRes', (proxyRes, req, res) => {
          const remoteUrl = endpoint.url.replace(/\/$/, '') + req.url
          const statusCode = res.statusCode
          const method = req.method
          proxy.on('end', () => {
            const reqTimerEnd = new Date()
            jsonLog.info({
              short_message: method,
              traceId: requestId,
              client: 'PROXY',
              http_status: statusCode,
              request_method: method,
              url: remoteUrl,
              time_ms: reqTimerEnd - reqTimerStart
            })
          })
        })
        proxy.on('error', (e) => {
          jsonLog.error({
            short_message: 'error',
            traceId: requestId,
            client: 'PROXY',
            error_msg: `${e}`,
            http_status: httpcode.InternalServerError
          })
        })

        if (envelopRequest) {
          proxy.on('proxyRes', (proxyRes, req, res) => {

            if (config.keepResponseHeaders) {
              keepResponseHeaders(proxyRes.headers)
            }

            const body = []
            proxyRes.on('error', (e) => {
              logger.warn(e)
            })
            proxyRes.on('data', chunk => body.push(chunk))
            proxyRes.on('end', () => {
              proxyRes.body = Buffer.concat(body).toString()
              endpointDone(endpoint, proxyRes)
            })
          })
          proxy.on('error', (e) => endpointDone(endpoint, e))
        } else {
          proxy.on('error', () => res.sendStatus(httpcode.BadGateway))
        }
        proxy.web(req, res, {
          ...await proxyOptionsForEndpoint({ db, endpoint }),
          target: endpoint.url,
          changeOrigin: true,
          selfHandleResponse: envelopRequest
        })
        reqTimerStart = new Date()
      } catch (err) {
        logger.warn(err)
        res.sendStatus(httpcode.InternalServerError).end()
      }
    })
  }
}

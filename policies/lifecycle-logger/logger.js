const jsonLog = require('../../lib/json_log')

module.exports = () => {
  return (req, res, next) => {
    const reqTimerStart = new Date()
    const method = req.method
    const url = req.originalUrl
    res.on('finish', () => {
      const app = req.egContext.app // set by gatekeeper policy
      const requestId = req.egContext.requestID
      const reqTimerEnd = new Date()
      const statusCode = res.statusCode
      jsonLog.info({
        short_message: method,
        traceId: requestId,
        client: app,
        http_status: statusCode,
        request_method: method,
        url: url,
        time_ms: reqTimerEnd - reqTimerStart
      })
    })
    next()
  }
}

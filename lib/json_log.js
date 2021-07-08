const log = (data) => {
  console.log(JSON.stringify(data))
}

module.exports = {
  log: log,
  panic: (data) => {
    data.level = 0
    log(data)
  },
  fatal: (data) => {
    data.level = 2
    log(data)
  },
  error: (data) => {
    data.level = 3
    log(data)
  },
  warn: (data) => {
    data.level = 4
    log(data)
  },
  info: (data) => {
    data.level = 6
    log(data)
  },
  debug: (data) => {
    data.level = 7
    log(data)
  }
}

function loadServer () {
  const express = require('express')
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  const port = 3900

  app.get('/', (req, res) => {
    res.send(req.body)
  })

  app.listen(port, () => {
    console.log('Example app listening at http://localhost:' + port)
  })
}

module.exports = {
  loadServer
}

import { createApplication } from './application.mjs'

const application = createApplication()
application.server.listen(application.config.port, '127.0.0.1', () => {
  console.log(`GEO Growth Harness API listening on http://127.0.0.1:${application.config.port}`)
})

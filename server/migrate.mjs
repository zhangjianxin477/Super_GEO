import { join } from 'node:path'
import { loadConfig } from './config.mjs'
import { migrate, openDatabase } from './database.mjs'

const config = loadConfig(); const db = openDatabase(config)
migrate(db, join(config.projectRoot, 'server', 'migrations'))
console.log(`Migrations applied to ${config.dbPath}`)
db.close()

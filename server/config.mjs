import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function loadConfig(overrides = {}) {
  const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const dataDir = resolve(overrides.dataDir ?? process.env.GEO_DATA_DIR ?? join(projectRoot, 'data'))
  const dbPath = resolve(overrides.dbPath ?? process.env.GEO_DB_PATH ?? join(dataDir, 'geo-harness.sqlite'))
  const port = Number(overrides.port ?? process.env.PORT ?? 8787)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.')
  const environment = overrides.environment ?? process.env.NODE_ENV ?? 'development'
  const secretEncryptionKey = overrides.secretEncryptionKey ?? process.env.GEO_SECRET_ENCRYPTION_KEY ?? ''
  return { projectRoot, dataDir, dbPath, port, environment, secretEncryptionKey }
}

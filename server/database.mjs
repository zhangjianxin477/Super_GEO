import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function openDatabase(config) {
  mkdirSync(dirname(config.dbPath), { recursive: true })
  const db = new DatabaseSync(config.dbPath)
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  return db
}

export function migrate(db, migrationsDirectory) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);')
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id))
  const migrations = readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql')).sort()
  for (const id of migrations) {
    if (applied.has(id)) continue
    const source = readFileSync(join(migrationsDirectory, id), 'utf8')
    // SQLite only applies PRAGMA foreign_keys changes outside a transaction. A small
    // number of migrations must rebuild tables to replace an existing foreign key;
    // those migrations opt in explicitly and are checked before they commit.
    const requiresForeignKeysOff = source.includes('-- migration: foreign_keys_off')
    if (requiresForeignKeysOff) db.exec('PRAGMA foreign_keys = OFF')
    let transactionOpen = false
    try {
      db.exec('BEGIN')
      transactionOpen = true
      db.exec(source)
      if (requiresForeignKeysOff) {
        const violations = db.prepare('PRAGMA foreign_key_check').all()
        if (violations.length) throw new Error(`Foreign-key check failed: ${JSON.stringify(violations.slice(0, 5))}`)
      }
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(id, new Date().toISOString())
      db.exec('COMMIT')
      transactionOpen = false
    } catch (error) {
      if (transactionOpen) db.exec('ROLLBACK')
      throw new Error(`Migration ${id} failed: ${error.message}`)
    } finally {
      if (requiresForeignKeysOff) db.exec('PRAGMA foreign_keys = ON')
    }
  }
}

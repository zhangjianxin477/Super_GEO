import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export function createSecretVault({ encryptionKey, environment }) {
  const productionWithoutKey = !encryptionKey && environment === 'production'
  const keyMaterial = encryptionKey || `development-only:${process.cwd()}`
  const key = createHash('sha256').update(keyMaterial).digest()
  const encrypt = (value) => {
    if (productionWithoutKey) throw new Error('GEO_SECRET_ENCRYPTION_KEY is required in production to store provider API keys.')
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return { encryptionVersion: encryptionKey ? 'aes-256-gcm-v1' : 'development-aes-256-gcm-v1', ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), fingerprint: createHash('sha256').update(value).digest('hex'), lastFour: value.slice(-4) }
  }
  const decrypt = (record) => { const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64')); decipher.setAuthTag(Buffer.from(record.authTag, 'base64')); return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8') }
  return { encrypt, decrypt, persistent: Boolean(encryptionKey) }
}
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSecretVault } from '../../server/security/secretVault.mjs'

describe('provider credential vault', () => {
  it('encrypts and decrypts a development credential while exposing only safe metadata', () => {
    const vault = createSecretVault({ encryptionKey: 'test-encryption-key', environment: 'test' })
    const encrypted = vault.encrypt('sk-example-1234')
    assert.equal(encrypted.lastFour, '1234')
    assert.equal(encrypted.ciphertext.includes('sk-example-1234'), false)
    assert.equal(vault.decrypt(encrypted), 'sk-example-1234')
  })

  it('refuses to encrypt credentials in production without an explicit encryption key', () => {
    const vault = createSecretVault({ encryptionKey: '', environment: 'production' })
    assert.throws(() => vault.encrypt('sk-example-1234'), /GEO_SECRET_ENCRYPTION_KEY is required/i)
  })
})

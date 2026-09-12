/**
 * LicenseFlow CLI — Persistent Encrypted Entitlement Cache
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CacheConfig {
  strategy: 'cache-first' | 'stale-while-revalidate' | 'network-first';
  ttlSeconds: number;
  offlineGracePeriodHours: number;
  persistPath?: string;
  encryptionKey?: string;
}

export interface CachedEntry<T = unknown> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  proofJwt?: string;
  source: 'network' | 'cache' | 'offline';
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, 'licenseflow-cache-v1', KEY_LENGTH);
}

function encrypt(data: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decrypt(payload: string, key: Buffer): string {
  const [ivB64, authTagB64, encryptedB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export class EntitlementCache {
  private memory: Map<string, CachedEntry> = new Map();
  private config: CacheConfig;
  private encKey: Buffer;

  constructor(apiKey: string, config?: Partial<CacheConfig>) {
    this.config = {
      strategy: config?.strategy || 'stale-while-revalidate',
      ttlSeconds: config?.ttlSeconds || 300,
      offlineGracePeriodHours: config?.offlineGracePeriodHours || 72,
      persistPath: config?.persistPath,
      encryptionKey: config?.encryptionKey,
    };

    this.encKey = deriveKey(this.config.encryptionKey || apiKey);

    if (this.config.persistPath) {
      this.loadFromDisk();
    }
  }

  get<T>(key: string): CachedEntry<T> | null {
    const entry = this.memory.get(key) as CachedEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();
    if (now < entry.expiresAt) {
      return { ...entry, source: 'cache' };
    }

    const graceMs = this.config.offlineGracePeriodHours * 3600 * 1000;
    if (now < entry.cachedAt + graceMs) {
      return { ...entry, source: 'offline' };
    }

    this.memory.delete(key);
    this.persistToDisk();
    return null;
  }

  set<T>(key: string, data: T, proofJwt?: string): void {
    const now = Date.now();
    const entry: CachedEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + this.config.ttlSeconds * 1000,
      proofJwt,
      source: 'network',
    };

    this.memory.set(key, entry as CachedEntry<unknown>);
    this.persistToDisk();
  }

  invalidate(key: string): void {
    this.memory.delete(key);
    this.persistToDisk();
  }

  flush(): void {
    this.memory.clear();
    this.persistToDisk();
  }

  stats(): { size: number; keys: string[] } {
    return {
      size: this.memory.size,
      keys: Array.from(this.memory.keys()),
    };
  }

  private persistToDisk(): void {
    if (!this.config.persistPath) return;

    try {
      const entries: Record<string, CachedEntry> = {};
      for (const [key, value] of this.memory) {
        entries[key] = value;
      }

      const plaintext = JSON.stringify(entries);
      const encrypted = encrypt(plaintext, this.encKey);
      const dir = path.dirname(this.config.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.config.persistPath, encrypted, 'utf8');
    } catch (err) {
      console.warn('LicenseFlow: Failed to persist cache:', err);
    }
  }

  private loadFromDisk(): void {
    if (!this.config.persistPath) return;

    try {
      if (!fs.existsSync(this.config.persistPath)) return;

      const encrypted = fs.readFileSync(this.config.persistPath, 'utf8');
      const plaintext = decrypt(encrypted, this.encKey);
      const entries = JSON.parse(plaintext) as Record<string, CachedEntry>;

      const now = Date.now();
      const graceMs = this.config.offlineGracePeriodHours * 3600 * 1000;

      for (const [key, entry] of Object.entries(entries)) {
        if (now < entry.cachedAt + graceMs) {
          this.memory.set(key, entry);
        }
      }
    } catch (err) {
      console.warn('LicenseFlow: Failed to load persistent cache (may be corrupted):', err);
      try {
        if (this.config.persistPath && fs.existsSync(this.config.persistPath)) {
          fs.unlinkSync(this.config.persistPath);
        }
      } catch { /* ignore */ }
    }
  }
}

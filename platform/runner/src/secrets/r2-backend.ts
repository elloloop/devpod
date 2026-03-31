/**
 * Cloudflare R2 secrets backend.
 *
 * Stores secrets as an encrypted JSON file in an R2 bucket.
 * Uses the AWS S3 SDK pointed at the R2 endpoint.
 *
 * Env vars:
 *   RUNNER_R2_ACCOUNT_ID   - Cloudflare account ID
 *   RUNNER_R2_ACCESS_KEY_ID - R2 access key
 *   RUNNER_R2_SECRET_ACCESS_KEY - R2 secret key
 *   RUNNER_R2_BUCKET       - Bucket name (default: devpod-secrets)
 *   RUNNER_R2_ENDPOINT     - Endpoint URL (derived from account ID if not set)
 *   RUNNER_SECRETS_KEY     - Encryption key (shared with local store)
 */

import * as crypto from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { SecretsBackend } from './backend.js';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT = 'local-runner-secrets-salt';

interface EncryptedPayload {
  encrypted: true;
  iv: string;
  data: string;
}

function deriveKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, SALT, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

function encrypt(data: string, key: Buffer): { iv: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(data, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  const combined = encrypted + '.' + authTag.toString('base64');
  return { iv: iv.toString('base64'), ciphertext: combined };
}

function decrypt(ciphertext: string, iv: string, key: Buffer): string {
  const [encData, authTagB64] = ciphertext.split('.');
  const ivBuf = Buffer.from(iv, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encData, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

export class R2Backend implements SecretsBackend {
  readonly name = 'r2';

  private client: S3Client | null = null;
  private bucket: string;
  private objectKey: string;
  private encryptionKey: Buffer | null = null;

  constructor(private workspaceHash: string) {
    const accountId = process.env.RUNNER_R2_ACCOUNT_ID;
    const accessKeyId = process.env.RUNNER_R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.RUNNER_R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.RUNNER_R2_BUCKET || 'devpod-secrets';
    this.objectKey = `secrets/${workspaceHash}.json.enc`;

    if (accountId && accessKeyId && secretAccessKey) {
      const endpoint = process.env.RUNNER_R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
    }

    const masterPassword = process.env.RUNNER_SECRETS_KEY;
    if (masterPassword) {
      this.encryptionKey = deriveKey(masterPassword);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async pull(): Promise<Record<string, string>> {
    if (!this.client) return {};

    try {
      const resp = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey }),
      );
      const body = await resp.Body?.transformToString('utf-8');
      if (!body) return {};

      const parsed = JSON.parse(body);

      if (parsed.encrypted === true) {
        if (!this.encryptionKey) {
          throw new Error(
            'R2 secrets file is encrypted but RUNNER_SECRETS_KEY is not set. Cannot decrypt.',
          );
        }
        const payload = parsed as EncryptedPayload;
        const decrypted = decrypt(payload.data, payload.iv, this.encryptionKey);
        return JSON.parse(decrypted) as Record<string, string>;
      }

      // Plaintext
      return parsed as Record<string, string>;
    } catch (err: unknown) {
      // NoSuchKey means the file doesn't exist yet — return empty
      if (isS3NoSuchKey(err)) {
        return {};
      }
      // Encryption mismatch surfaces as a decryption error
      if (err instanceof Error && err.message.includes('Unsupported state or unable to authenticate data')) {
        throw new Error('R2 secrets decryption failed — RUNNER_SECRETS_KEY may not match the key used to encrypt. ' + err.message);
      }
      console.warn(`[r2-backend] Failed to pull secrets: ${err instanceof Error ? err.message : String(err)}`);
      return {};
    }
  }

  async push(name: string, value: string): Promise<void> {
    if (!this.client) return;

    try {
      const current = await this.pull();
      current[name] = value;
      await this.upload(current);
    } catch (err) {
      console.warn(`[r2-backend] Failed to push secret '${name}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async remove(name: string): Promise<void> {
    if (!this.client) return;

    try {
      const current = await this.pull();
      delete current[name];
      if (Object.keys(current).length === 0) {
        // Remove the file entirely if no secrets remain
        await this.client.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey }),
        );
      } else {
        await this.upload(current);
      }
    } catch (err) {
      console.warn(`[r2-backend] Failed to remove secret '${name}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Private ──

  private async upload(secrets: Record<string, string>): Promise<void> {
    if (!this.client) return;

    let body: string;
    if (this.encryptionKey) {
      const plaintext = JSON.stringify(secrets);
      const { iv, ciphertext } = encrypt(plaintext, this.encryptionKey);
      const payload: EncryptedPayload = { encrypted: true, iv, data: ciphertext };
      body = JSON.stringify(payload);
    } else {
      console.warn('[r2-backend] RUNNER_SECRETS_KEY not set — storing secrets as plaintext in R2');
      body = JSON.stringify(secrets);
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey,
        Body: body,
        ContentType: 'application/json',
      }),
    );
  }
}

function isS3NoSuchKey(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = (err as { name?: string }).name;
  const code = (err as { Code?: string }).Code;
  return name === 'NoSuchKey' || code === 'NoSuchKey';
}

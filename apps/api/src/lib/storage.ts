import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Storage as GcsClient } from '@google-cloud/storage';
import { AppError } from './errors.js';

export interface StoredBlob {
  buffer: Buffer;
  mimeType: string;
}

export interface ObjectStorage {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<StoredBlob>;
  delete(key: string): Promise<void>;
  /** Optional pre-signed download URL (GCS / S3). */
  signedUrl?(key: string, expiresSeconds?: number): Promise<string | null>;
}

/** Local disk storage for development. */
export class LocalStorage implements ObjectStorage {
  constructor(private rootDir: string) {}

  private pathForKey(key: string) {
    return join(this.rootDir, key);
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    const full = this.pathForKey(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, buffer);
  }

  async read(key: string): Promise<StoredBlob> {
    try {
      const buffer = await readFile(this.pathForKey(key));
      return { buffer, mimeType: 'application/octet-stream' };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') throw new AppError('File not found.', 404);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathForKey(key), { force: true });
  }

  async signedUrl(): Promise<string | null> {
    return null;
  }
}

export class GcsStorage implements ObjectStorage {
  private bucket;

  constructor(bucketName: string) {
    this.bucket = new GcsClient().bucket(bucketName);
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await this.bucket.file(key).save(buffer);
  }

  async read(key: string): Promise<StoredBlob> {
    const file = this.bucket.file(key);
    const [buffer] = await file.download();
    const [meta] = await file.getMetadata();
    return {
      buffer,
      mimeType: typeof meta.contentType === 'string' ? meta.contentType : 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  async signedUrl(key: string, expiresSeconds = 300): Promise<string | null> {
    const [url] = await this.bucket.file(key).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresSeconds * 1000,
    });
    return url;
  }
}

export class S3Storage implements ObjectStorage {
  private client = new S3Client({});

  constructor(private bucket: string) {}

  async save(key: string, buffer: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
      }),
    );
  }

  async read(key: string): Promise<StoredBlob> {
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object for ${key}`);
    return {
      buffer: Buffer.from(bytes),
      mimeType: out.ContentType || 'application/octet-stream',
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async signedUrl(_key: string, _expiresSeconds = 300): Promise<string | null> {
    // Prefer GCS in production. S3 signed URLs need @aws-sdk/s3-request-presigner.
    return null;
  }
}

let storage: ObjectStorage | null = null;

export function getStorage(): ObjectStorage {
  if (!storage) {
    const gcsBucket = process.env.GCS_BUCKET?.trim();
    const s3Bucket = process.env.AWS_S3_BUCKET?.trim();
    if (gcsBucket) {
      storage = new GcsStorage(gcsBucket);
    } else if (s3Bucket) {
      storage = new S3Storage(s3Bucket);
    } else {
      const root = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
      storage = new LocalStorage(root);
    }
  }
  return storage;
}

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface StoredBlob {
  buffer: Buffer;
  mimeType: string;
}

/** Local disk storage for dev; swap to S3 pre-signed URLs in production. */
export class LocalStorage {
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
    const buffer = await readFile(this.pathForKey(key));
    return { buffer, mimeType: 'application/octet-stream' };
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathForKey(key), { force: true });
  }
}

let storage: LocalStorage | null = null;

export function getStorage(): LocalStorage {
  if (!storage) {
    const root = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
    storage = new LocalStorage(root);
  }
  return storage;
}

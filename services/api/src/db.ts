import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new sqlite3.Database(dbPath);

export function initDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Create shares table
      db.run(`
        CREATE TABLE IF NOT EXISTS shares (
          id TEXT PRIMARY KEY,
          share_type TEXT NOT NULL,
          access_mode TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          nonce TEXT NOT NULL,
          tag TEXT NOT NULL,
          wrapped_content_key TEXT,
          salt TEXT,
          burn_after_reading INTEGER NOT NULL DEFAULT 0,
          file_meta TEXT,
          expires_at INTEGER,
          consumed_at INTEGER,
          created_at INTEGER NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create shares table:', err);
          return reject(err);
        }
      });

      // 2. Create comments table
      db.run(`
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          share_id TEXT NOT NULL,
          encrypted_author TEXT NOT NULL,
          author_nonce TEXT NOT NULL,
          author_tag TEXT NOT NULL,
          ciphertext TEXT NOT NULL,
          nonce TEXT NOT NULL,
          tag TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Failed to create comments table:', err);
          return reject(err);
        }
        console.log('✓ SQLite database initialized successfully.');
        resolve();
      });
    });
  });
}

// Promisified DB helpers to keep controllers clean
export const dbRun = (sql: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const dbGet = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const dbAll = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

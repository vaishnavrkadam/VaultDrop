import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';

const isPg = !!process.env.DATABASE_URL;
let pgPool: pg.Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

export function initDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isPg) {
      console.log('SYSTEM: INITIALIZING POSTGRESQL DB ENGINE...');
      pgPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for cloud databases like Neon and Supabase
      });

      // Create Tables in PostgreSQL
      pgPool.query(`
        CREATE TABLE IF NOT EXISTS shares (
          id VARCHAR(255) PRIMARY KEY,
          share_type VARCHAR(50) NOT NULL,
          access_mode VARCHAR(50) NOT NULL,
          ciphertext TEXT NOT NULL,
          nonce VARCHAR(255) NOT NULL,
          tag VARCHAR(255) NOT NULL,
          wrapped_content_key TEXT,
          salt VARCHAR(255),
          burn_after_reading INTEGER NOT NULL DEFAULT 0,
          file_meta TEXT,
          expires_at BIGINT,
          consumed_at BIGINT,
          created_at BIGINT NOT NULL,
          allow_comments INTEGER NOT NULL DEFAULT 0,
          creator_public_key TEXT,
          recovery_envelope TEXT,
          view_count INTEGER DEFAULT 0,
          max_views INTEGER
        );

        CREATE TABLE IF NOT EXISTS comments (
          id VARCHAR(255) PRIMARY KEY,
          share_id VARCHAR(255) NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
          encrypted_author TEXT NOT NULL,
          author_nonce VARCHAR(255) NOT NULL,
          author_tag VARCHAR(255) NOT NULL,
          ciphertext TEXT NOT NULL,
          nonce VARCHAR(255) NOT NULL,
          tag VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS threshold_policies (
          share_id VARCHAR(255) PRIMARY KEY REFERENCES shares(id) ON DELETE CASCADE,
          threshold INTEGER NOT NULL,
          participant_count INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS threshold_shares (
          id VARCHAR(255) PRIMARY KEY,
          share_id VARCHAR(255) NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
          share_index INTEGER NOT NULL,
          encrypted_secret_share TEXT NOT NULL,
          created_at BIGINT NOT NULL,
          UNIQUE(share_id, share_index)
        );

        CREATE TABLE IF NOT EXISTS rooms (
          id VARCHAR(255) PRIMARY KEY,
          access_mode VARCHAR(50) NOT NULL,
          salt VARCHAR(255),
          wrapped_room_key TEXT,
          nonce VARCHAR(255),
          tag VARCHAR(255),
          creator_public_key TEXT,
          recovery_envelope TEXT,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS room_messages (
          id VARCHAR(255) PRIMARY KEY,
          room_id VARCHAR(255) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          sender_hash VARCHAR(255) NOT NULL,
          ciphertext TEXT NOT NULL,
          nonce VARCHAR(255) NOT NULL,
          tag VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS room_attachments (
          id VARCHAR(255) PRIMARY KEY,
          room_id VARCHAR(255) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          ciphertext TEXT NOT NULL,
          nonce VARCHAR(255) NOT NULL,
          tag VARCHAR(255) NOT NULL,
          file_meta TEXT NOT NULL,
          created_at BIGINT NOT NULL
        );
      `)
        .then(async () => {
          await pgPool!.query('ALTER TABLE shares ADD COLUMN IF NOT EXISTS allow_comments INTEGER NOT NULL DEFAULT 0');
          await pgPool!.query('ALTER TABLE shares ADD COLUMN IF NOT EXISTS creator_public_key TEXT');
          await pgPool!.query('ALTER TABLE shares ADD COLUMN IF NOT EXISTS recovery_envelope TEXT');
          await pgPool!.query('ALTER TABLE shares ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0');
          await pgPool!.query('ALTER TABLE shares ADD COLUMN IF NOT EXISTS max_views INTEGER');
          console.log('✓ PostgreSQL database initialized successfully.');
          resolve();
        })
        .catch((err: any) => {
          console.error('Failed to create PostgreSQL tables:', err);
          reject(err);
        });
    } else {
      console.log('SYSTEM: INITIALIZING SQLITE DB ENGINE...');
      const dbPath = path.join(process.cwd(), 'database.sqlite');
      sqliteDb = new sqlite3.Database(dbPath);

      sqliteDb.serialize(() => {
        // Enable foreign key support in SQLite
        sqliteDb!.run('PRAGMA foreign_keys = ON;');

        // Create tables in SQLite
        sqliteDb!.run(`
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
            created_at INTEGER NOT NULL,
            allow_comments INTEGER NOT NULL DEFAULT 0,
            creator_public_key TEXT,
            recovery_envelope TEXT,
            view_count INTEGER DEFAULT 0,
            max_views INTEGER
          )
        `);

        sqliteDb!.run(`
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
        `);

        sqliteDb!.run(`
          CREATE TABLE IF NOT EXISTS threshold_policies (
            share_id TEXT PRIMARY KEY,
            threshold INTEGER NOT NULL,
            participant_count INTEGER NOT NULL,
            FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
          )
        `);

        sqliteDb!.run(`
          CREATE TABLE IF NOT EXISTS threshold_shares (
            id TEXT PRIMARY KEY,
            share_id TEXT NOT NULL,
            share_index INTEGER NOT NULL,
            encrypted_secret_share TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
            UNIQUE(share_id, share_index)
          )
        `);

        sqliteDb!.run(`
          CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            access_mode TEXT NOT NULL,
            salt TEXT,
            wrapped_room_key TEXT,
            nonce TEXT,
            tag TEXT,
            creator_public_key TEXT,
            recovery_envelope TEXT,
            created_at INTEGER NOT NULL
          )
        `);

        sqliteDb!.run(`
          CREATE TABLE IF NOT EXISTS room_messages (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL,
            sender_hash TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            nonce TEXT NOT NULL,
            tag TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
          )
        `);

        sqliteDb!.run(`
          CREATE TABLE IF NOT EXISTS room_attachments (
            id TEXT PRIMARY KEY,
            room_id TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            nonce TEXT NOT NULL,
            tag TEXT NOT NULL,
            file_meta TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Failed to create SQLite tables:', err);
            return reject(err);
          }
          // Run SQLite alter migrations sequentially (ignoring duplicate column errors)
          sqliteDb!.run('ALTER TABLE shares ADD COLUMN allow_comments INTEGER NOT NULL DEFAULT 0', () => {
          sqliteDb!.run('ALTER TABLE shares ADD COLUMN creator_public_key TEXT', () => {
          sqliteDb!.run('ALTER TABLE shares ADD COLUMN recovery_envelope TEXT', () => {
          sqliteDb!.run('ALTER TABLE shares ADD COLUMN view_count INTEGER DEFAULT 0', () => {
          sqliteDb!.run('ALTER TABLE shares ADD COLUMN max_views INTEGER', () => {
            console.log('✓ SQLite database initialized successfully.');
            resolve();
          });
          });
          });
          });
          });
        });
      });
    }
  });
}

// Convert SQLite parameter placeholders (?) to PostgreSQL ($1, $2, ...)
function convertSql(sql: string): string {
  if (!isPg) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export const dbRun = (sql: string, params: any[] = []): Promise<void> => {
  if (isPg) {
    return pgPool!.query(convertSql(sql), params).then(() => {});
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb!.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export const dbGet = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
  if (isPg) {
    return pgPool!.query(convertSql(sql), params).then((res: any) => res.rows[0] as T);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }
};

export const dbAll = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  if (isPg) {
    return pgPool!.query(convertSql(sql), params).then((res: any) => res.rows as T[]);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }
};

export function closeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sqliteDb) {
      sqliteDb.close((err) => {
        if (err) {
          reject(err);
        } else {
          sqliteDb = null;
          resolve();
        }
      });
    } else if (pgPool) {
      pgPool.end()
        .then(() => {
          pgPool = null;
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    } else {
      resolve();
    }
  });
}


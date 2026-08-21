"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbAll = exports.dbGet = exports.dbRun = void 0;
exports.initDb = initDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(process.cwd(), 'database.sqlite');
const db = new sqlite3_1.default.Database(dbPath);
function initDb() {
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
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
};
exports.dbRun = dbRun;
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
};
exports.dbGet = dbGet;
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};
exports.dbAll = dbAll;

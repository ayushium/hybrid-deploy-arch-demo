import mysql from 'mysql2/promise';
import type { Post } from '@campuswall/shared';

let pool: mysql.Pool;

export function getPool(): mysql.Pool {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? 'local',
    database: process.env.DB_NAME ?? 'campuswall',
    waitForConnections: true,
    connectionLimit: 10,
    // Keep this tight: a slow DB should fail fast, not pile up requests
    // until the health check times out and the ALB evicts us.
    connectTimeout: 5000,
  });
  return pool;
}

/**
 * Idempotent, runs at every boot. Same code path locally and on EC2, so
 * there is no separate migration step to forget.
 */
export async function initSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS posts (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      kind       ENUM('preset','emoji') NOT NULL,
      idx        TINYINT UNSIGNED NOT NULL,
      nick       VARCHAR(32)  NOT NULL,
      served_by  VARCHAR(32)  NOT NULL,
      az         VARCHAR(20)  NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at)
    )
  `);

  // AUTO_INCREMENT does all the work: every session gets a distinct, ordered
  // seq, atomically, with no locking or retry logic of our own. The display
  // name is derived from that number.
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS sessions (
      seq        INT AUTO_INCREMENT PRIMARY KEY,
      session    CHAR(36) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/** Returns this session's sequence number, creating it on first contact. */
export async function sessionSeq(session: string): Promise<number> {
  // INSERT IGNORE: a second request for the same session is a no-op rather
  // than an error, so there is no exception path to get wrong.
  const [res] = await getPool().execute<mysql.ResultSetHeader>(
    'INSERT IGNORE INTO sessions (session) VALUES (?)',
    [session],
  );
  if (res.insertId) return res.insertId;

  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    'SELECT seq FROM sessions WHERE session = ?',
    [session],
  );
  return Number(rows[0].seq);
}

export async function listPosts(limit = 50): Promise<Post[]> {
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    'SELECT id, kind, idx, nick, served_by, az, created_at FROM posts ORDER BY id DESC LIMIT ?',
    [limit],
  );
  return rows as unknown as Post[];
}

export async function insertPost(p: {
  kind: string;
  idx: number;
  nick: string;
  served_by: string;
  az: string;
}): Promise<number> {
  const [res] = await getPool().execute<mysql.ResultSetHeader>(
    'INSERT INTO posts (kind, idx, nick, served_by, az) VALUES (?, ?, ?, ?, ?)',
    [p.kind, p.idx, p.nick, p.served_by, p.az],
  );
  return res.insertId;
}

export async function dbHealthy(): Promise<boolean> {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

import crypto from 'crypto';
import { seedUsers } from './seedUsers.js';

// PBKDF2 Password Hashing
export function hashPassword(password, salt) {
  const saltHex = salt || crypto.randomBytes(16).toString('hex');
  const dk = crypto.pbkdf2Sync(password, saltHex, 100000, 32, 'sha256');
  return `${saltHex}$${dk.toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  try {
    if (!storedHash || typeof storedHash !== 'string') return false;
    const [saltHex, expectedHex] = storedHash.split('$');
    if (!saltHex || !expectedHex) return false;
    const dk = crypto.pbkdf2Sync(password, saltHex, 100000, 32, 'sha256');
    const computedHex = dk.toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(expectedHex));
  } catch {
    return false;
  }
}

export function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (!parts.length || !parts[0]) return 'US';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatUserResponse(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    companyName: u.company_name || u.companyName || '',
    printerModel: u.printer_model || u.printerModel || '',
    role: u.role || 'shop_owner',
    plan: u.plan || 'Pro Print House',
    initials: u.initials || getInitials(u.name),
    avatarColor: u.avatar_color || u.avatarColor || 'from-purple-600 to-indigo-600',
    createdAt: u.created_at || u.createdAt || new Date().toISOString()
  };
}

// In-memory fallback map seeded with all users
const memoryStore = new Map();

for (const u of seedUsers) {
  memoryStore.set(u.email.toLowerCase(), u);
}

function getTursoEndpoint() {
  const rawUrl = process.env.TURSO_DATABASE_URL || process.env.SQLITE_URL || process.env.LIBSQL_URL;
  if (!rawUrl) return null;

  let httpUrl = rawUrl.trim();
  if (httpUrl.startsWith('libsql://')) {
    httpUrl = 'https://' + httpUrl.substring(9);
  }
  if (!httpUrl.endsWith('/v2/pipeline')) {
    httpUrl = httpUrl.replace(/\/+$/, '') + '/v2/pipeline';
  }

  const token = process.env.TURSO_AUTH_TOKEN || process.env.SQLITE_AUTH_TOKEN || '';
  return { url: httpUrl, token };
}

function formatSqlArg(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { type: 'integer', value: String(val) } : { type: 'float', value: val };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  return { type: 'text', value: String(val) };
}

export async function executeSql(sql, args = []) {
  const turso = getTursoEndpoint();
  if (!turso) return [];

  try {
    const formattedArgs = args.map(formatSqlArg);
    const body = {
      requests: [
        {
          type: 'execute',
          stmt: {
            sql,
            args: formattedArgs
          }
        },
        {
          type: 'close'
        }
      ]
    };

    const resp = await fetch(turso.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(turso.token ? { Authorization: `Bearer ${turso.token}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      console.error('Turso HTTP request failed:', resp.status);
      return [];
    }

    const data = await resp.json();
    const result = data.results?.[0]?.response?.result;
    if (!result || !result.cols || !result.rows) {
      return [];
    }

    const colNames = result.cols.map((c) => c.name);
    return result.rows.map((row) => {
      const obj = {};
      row.forEach((cell, idx) => {
        obj[colNames[idx]] = cell.value !== undefined ? cell.value : null;
      });
      return obj;
    });
  } catch (err) {
    console.error('Failed to execute SQL against Turso:', err);
    return [];
  }
}

let tableInitialized = false;

export async function initDbSchema() {
  if (tableInitialized) return;
  const turso = getTursoEndpoint();
  if (turso) {
    try {
      await executeSql(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          company_name TEXT NOT NULL,
          printer_model TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'shop_owner',
          plan TEXT NOT NULL DEFAULT 'Pro Print House',
          initials TEXT NOT NULL,
          avatar_color TEXT NOT NULL,
          created_at TEXT NOT NULL,
          password_hash TEXT NOT NULL
        )
      `);

      for (const def of seedUsers) {
        const existing = await executeSql('SELECT id FROM users WHERE LOWER(email) = ?', [def.email.toLowerCase()]);
        if (!existing || existing.length === 0) {
          await executeSql(
            `INSERT OR IGNORE INTO users (
              id, name, email, company_name, printer_model,
              role, plan, initials, avatar_color, created_at, password_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              def.id,
              def.name,
              def.email.toLowerCase(),
              def.company_name,
              def.printer_model,
              def.role,
              def.plan,
              def.initials,
              def.avatar_color,
              def.created_at,
              def.password_hash
            ]
          );
        }
      }
    } catch (e) {
      console.error('Turso init schema error:', e);
    }
  }
  tableInitialized = true;
}

export async function getUserByEmail(email) {
  const emailNorm = (email || '').trim().toLowerCase();
  await initDbSchema();

  const turso = getTursoEndpoint();
  if (turso) {
    try {
      const rows = await executeSql('SELECT * FROM users WHERE LOWER(email) = ?', [emailNorm]);
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (e) {
      console.error('Turso select error:', e);
    }
  }

  return memoryStore.get(emailNorm) || null;
}

export async function insertUser(user) {
  await initDbSchema();
  const turso = getTursoEndpoint();

  if (turso) {
    try {
      await executeSql(
        `INSERT INTO users (
          id, name, email, company_name, printer_model,
          role, plan, initials, avatar_color, created_at, password_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.name,
          user.email.toLowerCase(),
          user.company_name,
          user.printer_model,
          user.role,
          user.plan,
          user.initials,
          user.avatar_color,
          user.created_at,
          user.password_hash
        ]
      );
    } catch (e) {
      console.error('Turso insert error:', e);
    }
  }

  memoryStore.set(user.email.toLowerCase(), user);
  return true;
}

export async function updateUser(email, updates) {
  const existing = await getUserByEmail(email);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  const turso = getTursoEndpoint();

  if (turso) {
    try {
      await executeSql(
        `UPDATE users SET
          name = ?,
          company_name = ?,
          printer_model = ?,
          password_hash = ?
        WHERE LOWER(email) = ?`,
        [
          updated.name,
          updated.company_name,
          updated.printer_model,
          updated.password_hash,
          email.trim().toLowerCase()
        ]
      );
    } catch (e) {
      console.error('Turso update error:', e);
    }
  }

  memoryStore.set(email.trim().toLowerCase(), updated);
  return updated;
}

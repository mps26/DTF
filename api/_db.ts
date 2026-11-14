import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface DbUser {
  id: string;
  name: string;
  email: string;
  company_name: string;
  printer_model: string;
  role: string;
  plan: string;
  initials: string;
  avatar_color: string;
  created_at: string;
  password_hash: string;
}

export function hashPassword(password: string, salt?: string): string {
  const saltHex = salt || crypto.randomBytes(16).toString('hex');
  const dk = crypto.pbkdf2Sync(password, saltHex, 100000, 32, 'sha256');
  return `${saltHex}$${dk.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [saltHex, expectedHex] = storedHash.split('$');
    if (!saltHex || !expectedHex) return false;
    const dk = crypto.pbkdf2Sync(password, saltHex, 100000, 32, 'sha256');
    const computedHex = dk.toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHex), Buffer.from(expectedHex));
  } catch {
    return false;
  }
}

// In-memory / process-level fallback store
const memoryFallbackStore = new Map<string, DbUser>();

// Initialize default demo users into fallback store
const defaultDemoUsers: DbUser[] = [
  {
    id: 'user_ninad_pawar',
    name: 'Ninad Pawar',
    email: 'ninad@dtflayout.com',
    company_name: 'Apex DTF Printworks',
    printer_model: '24" Dual Epson i3200 (Hoson)',
    role: 'shop_owner',
    plan: 'Industrial Enterprise',
    initials: 'NP',
    avatar_color: 'from-purple-600 to-indigo-600',
    created_at: '2026-01-15T08:00:00Z',
    password_hash: 'dc819a008f37f6b13ff717a4171c7641$ab5fb8e3a73782f029e01ec26ba2310596972456379030be1e12c3603e18fa33'
  },
  {
    id: 'user_demo_operator',
    name: 'Alex Turner',
    email: 'demo@dtflayout.com',
    company_name: 'Metro Gang Sheets Co.',
    printer_model: '22" 4-Head DTF Line (Maintop)',
    role: 'operator',
    plan: 'Pro Print House',
    initials: 'AT',
    avatar_color: 'from-blue-600 to-cyan-600',
    created_at: '2026-03-01T10:30:00Z',
    password_hash: '4ef99f21e8417628f439423557e01c0e$e541e72daa715e7467a03c6661dd28aa721270627e43e291e2e3fe3ff853560b'
  }
];

export function loadSeedUsers(): DbUser[] {
  try {
    const jsonPath = path.join(process.cwd(), 'server', 'dtf_users.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        return data as DbUser[];
      }
    }
  } catch (err) {
    console.warn('Could not read server/dtf_users.json:', err);
  }
  return defaultDemoUsers;
}

// Seed fallback store with existing DB users
for (const u of loadSeedUsers()) {
  memoryFallbackStore.set(u.email.toLowerCase(), u);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return 'US';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatUserResponse(u: DbUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    companyName: u.company_name,
    printerModel: u.printer_model,
    role: u.role,
    plan: u.plan,
    initials: u.initials,
    avatarColor: u.avatar_color,
    createdAt: u.created_at
  };
}

function getTursoEndpoint(): { url: string; token: string } | null {
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

function formatSqlArg(val: any) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { type: 'integer', value: String(val) } : { type: 'float', value: val };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  return { type: 'text', value: String(val) };
}

let tableInitialized = false;

export async function executeSql(sql: string, args: any[] = []): Promise<any[]> {
  const turso = getTursoEndpoint();

  if (!turso) {
    // Return empty array if no remote SQLite endpoint configured
    return [];
  }

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
      console.error('Turso HTTP request failed:', resp.status, await resp.text());
      return [];
    }

    const data: any = await resp.json();
    const result = data.results?.[0]?.response?.result;
    if (!result || !result.cols || !result.rows) {
      return [];
    }

    const colNames: string[] = result.cols.map((c: any) => c.name);
    return result.rows.map((row: any[]) => {
      const obj: any = {};
      row.forEach((cell: any, idx: number) => {
        obj[colNames[idx]] = cell.value !== undefined ? cell.value : null;
      });
      return obj;
    });
  } catch (err) {
    console.error('Failed to execute SQL against Turso:', err);
    return [];
  }
}

export async function initDbSchema(): Promise<void> {
  if (tableInitialized) return;
  const turso = getTursoEndpoint();
  if (turso) {
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

    // Seed default and existing operators into Turso if not present
    const seedList = loadSeedUsers();
    for (const def of seedList) {
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
  }
  tableInitialized = true;
}

// Database Operations
export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const emailNorm = email.trim().toLowerCase();
  await initDbSchema();

  const turso = getTursoEndpoint();
  if (turso) {
    const rows = await executeSql('SELECT * FROM users WHERE LOWER(email) = ?', [emailNorm]);
    if (rows && rows.length > 0) {
      return rows[0] as DbUser;
    }
  }

  // Fallback to in-memory store
  return memoryFallbackStore.get(emailNorm) || null;
}

export async function insertUser(user: DbUser): Promise<boolean> {
  await initDbSchema();
  const turso = getTursoEndpoint();

  if (turso) {
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
  }

  // Always keep in memory store as well
  memoryFallbackStore.set(user.email.toLowerCase(), user);
  return true;
}

export async function updateUser(email: string, updates: Partial<DbUser>): Promise<DbUser | null> {
  const existing = await getUserByEmail(email);
  if (!existing) return null;

  const updated: DbUser = { ...existing, ...updates };
  const turso = getTursoEndpoint();

  if (turso) {
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
  }

  memoryFallbackStore.set(email.trim().toLowerCase(), updated);
  return updated;
}


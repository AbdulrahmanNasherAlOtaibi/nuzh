import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "nuzha.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT DEFAULT '',
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',           -- user | provider | admin
  gender TEXT DEFAULT '',
  city TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',       -- active | disabled | banned
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_active TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  type TEXT NOT NULL,                          -- company | guide
  name TEXT NOT NULL,                          -- اسم الشركة أو الاسم الرباعي للمرشد
  license TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | active | suspended | banned
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reserves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  area_km2 REAL DEFAULT 0,
  animals TEXT DEFAULT '[]',                   -- JSON [{name, icon}]
  center_lat REAL, center_lng REAL, zoom REAL DEFAULT 8,
  zones TEXT DEFAULT '[]',                     -- JSON [{name, type: allowed|permit|forbidden, polygon:[[lat,lng]]}]
  visitors INTEGER DEFAULT 0,
  best_time TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  reserve_id INTEGER,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,                      -- eco | culture | fun | adventure | guided
  location TEXT DEFAULT '',
  price REAL NOT NULL,
  child_price REAL DEFAULT 0,
  duration_hours REAL DEFAULT 4,
  distance_km REAL DEFAULT 0,
  capacity INTEGER DEFAULT 20,
  image TEXT DEFAULT '/scenes/dunes-sunset.svg',
  dates TEXT DEFAULT '[]',                     -- JSON ISO dates
  status TEXT NOT NULL DEFAULT 'active',       -- active | hidden | pending | deleted
  weekend_offer INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  total REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'mada',
  promo_code TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmed',    -- pending | confirmed | cancelled | completed | refunded | disputed
  photos TEXT DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE,
  trip_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  text TEXT DEFAULT '',
  reply TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',    -- published | pending
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider_id INTEGER,
  booking_id INTEGER,
  type TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',     -- high | medium | low
  status TEXT NOT NULL DEFAULT 'new',          -- new | processing | closed
  reply TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  image TEXT DEFAULT '',
  link TEXT DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                          -- article | snapshot | report | behavior
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  image TEXT DEFAULT '',
  author TEXT DEFAULT 'فريق نزهة',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reserve_id INTEGER NOT NULL,
  permit_no TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review',       -- active | review | expired | rejected
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'percent',        -- percent | fixed
  value REAL NOT NULL,
  starts TEXT NOT NULL,
  ends TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  used INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏅',
  metric TEXT NOT NULL,                        -- trips | distance | reviews | photos | reserves | children | early | share | articles | categories
  target INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT DEFAULT 'شريك نجاح',
  logo TEXT DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER,
  provider_id INTEGER,
  amount REAL NOT NULL,
  fee REAL NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'mada',
  status TEXT NOT NULL DEFAULT 'paid',         -- paid | pending | failed | refunded
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_user_id INTEGER NOT NULL,
  subject TEXT DEFAULT '',
  body TEXT DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'مشرف',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  user_id INTEGER,
  ok INTEGER NOT NULL,
  ip TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT DEFAULT '',
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export const now = () => new Date().toISOString();

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key=?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db.prepare(
    "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, JSON.stringify(value));
}

export function logActivity(actor: string, action: string) {
  db.prepare("INSERT INTO activity_log (actor, action, created_at) VALUES (?,?,?)").run(actor, action, now());
}

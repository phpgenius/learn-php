/**
 * Learn PHP — subscription store.
 *
 * A dependency-free JSON-file store. It is deliberately simple so the whole
 * thing runs with `npm install && npm start`. Swap this module for your
 * database of choice (Postgres/MySQL/SQLite) before running real traffic —
 * the interface is small and the rest of the server only calls these methods.
 *
 * The single rule that matters: an account's plan is changed ONLY by a
 * verified Stripe webhook, never by the browser.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'learnphp.json');

function emptyDb() {
  return { users: {}, sessions: {}, events: [] };
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return emptyDb();
  }
}

function write(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic-ish: never a half-written file
}

/* ------------------------------------------------------------- passwords
   Node's built-in scrypt. No dependency, and unlike the browser demo's
   djb2 hash this is an actual memory-hard KDF with a per-user salt. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  // timingSafeEqual needs equal-length buffers
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* --------------------------------------------------------------- users */
export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function findUserByEmail(email) {
  const db = read();
  const key = normaliseEmail(email);
  return Object.values(db.users).find((u) => u.email === key) || null;
}

export function findUserByStripeCustomer(customerId) {
  const db = read();
  return Object.values(db.users).find((u) => u.stripeCustomerId === customerId) || null;
}

export function createUser({ email, name, password }) {
  const db = read();
  const key = normaliseEmail(email);
  if (Object.values(db.users).some((u) => u.email === key)) {
    const err = new Error('An account with that email already exists.');
    err.code = 'EMAIL_TAKEN';
    throw err;
  }
  const id = crypto.randomUUID();
  db.users[id] = {
    id,
    email: key,
    name: String(name || '').trim(),
    passwordHash: hashPassword(password),
    plan: 'free',
    billing: 'monthly',
    status: 'active', // active | canceled | past_due | incomplete
    seats: 1,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  write(db);
  return db.users[id];
}

export function getUser(id) {
  return read().users[id] || null;
}

export function updateUser(id, patch) {
  const db = read();
  if (!db.users[id]) return null;
  db.users[id] = { ...db.users[id], ...patch, updatedAt: new Date().toISOString() };
  write(db);
  return db.users[id];
}

/** Public shape — never let a password hash reach a response body. */
export function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}

/* ------------------------------------------------------------ sessions
   Opaque random token in an HttpOnly cookie. No JWT: nothing to forge,
   and revocation is a delete. */
export function createSession(userId, ttlDays = 30) {
  const db = read();
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 86400000).toISOString();
  db.sessions[token] = { userId, createdAt: new Date().toISOString(), expiresAt };
  write(db);
  return { token, expiresAt };
}

export function getSessionUser(token) {
  if (!token) return null;
  const db = read();
  const s = db.sessions[token];
  if (!s) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) {
    delete db.sessions[token];
    write(db);
    return null;
  }
  return db.users[s.userId] || null;
}

export function destroySession(token) {
  const db = read();
  delete db.sessions[token];
  write(db);
}

/* -------------------------------------------------------------- events
   Minimal conversion log. The site also sends these to Plausible; having
   them server-side means a Stripe webhook can record revenue events that a
   blocked client script would have missed. */
export function logEvent(name, props = {}) {
  const db = read();
  db.events.push({ name, props, at: new Date().toISOString() });
  if (db.events.length > 5000) db.events = db.events.slice(-5000);
  write(db);
}

/* ---------------------------------------------------- webhook idempotency
   Stripe retries webhooks. Recording the event id means a retry is a no-op
   instead of double-applying a plan change. */
export function markEventProcessed(eventId) {
  const db = read();
  db.processedEvents = db.processedEvents || {};
  if (db.processedEvents[eventId]) return false; // already handled
  db.processedEvents[eventId] = new Date().toISOString();
  // keep the map bounded
  const keys = Object.keys(db.processedEvents);
  if (keys.length > 2000) {
    for (const k of keys.slice(0, keys.length - 2000)) delete db.processedEvents[k];
  }
  write(db);
  return true;
}

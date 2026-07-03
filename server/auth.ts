import crypto from "node:crypto";
import type { Request, Response, NextFunction, Router } from "express";
import express from "express";
import { db, now, logActivity } from "./db.ts";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

export interface AuthedUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  avatar: string;
  city: string;
  gender: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
    provider?: { id: number; type: string; name: string; status: string };
  }
}

const COOKIE = "nuzha_sid";

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const cookie = req.headers.cookie || "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (match) {
    const token = decodeURIComponent(match.split("=")[1] || "");
    const row = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.avatar, u.city, u.gender
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
      )
      .get(token) as AuthedUser | undefined;
    if (row && row.status !== "banned" && row.status !== "disabled") {
      req.user = row;
      db.prepare("UPDATE users SET last_active=? WHERE id=?").run(now(), row.id);
      if (row.role === "provider") {
        req.provider = db
          .prepare("SELECT id, type, name, status FROM providers WHERE user_id=?")
          .get(row.id) as Request["provider"];
      }
    }
  }
  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "يلزم تسجيل الدخول" });
  next();
}

export function requireProvider(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "provider" || !req.provider)
    return res.status(401).json({ error: "هذه البوابة خاصة بمزودي الخدمة" });
  if (req.provider.status === "banned" || req.provider.status === "suspended")
    return res.status(403).json({ error: "حساب المزود موقوف حالياً" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "صلاحيات غير كافية" });
  next();
}

function createSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)").run(token, userId, now());
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
}

function publicUser(u: any) {
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
    avatar: u.avatar, city: u.city, gender: u.gender,
  };
}

export function authRouter(): Router {
  const r = express.Router();

  r.post("/register", (req, res) => {
    const { name, email, password, phone = "", gender = "", city = "" } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: "أكمل الاسم والإيميل وكلمة المرور" });
    if (String(password).length < 6) return res.status(400).json({ error: "كلمة المرور 6 أحرف على الأقل" });
    const exists = db.prepare("SELECT id FROM users WHERE email=?").get(String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: "هذا الإيميل مسجل مسبقاً" });
    const info = db
      .prepare(
        `INSERT INTO users (name,email,phone,password,role,gender,city,created_at,last_active,email_verified)
         VALUES (?,?,?,?,'user',?,?,?,?,1)`
      )
      .run(name, String(email).toLowerCase(), phone, hashPassword(password), gender, city, now(), now());
    createSession(res, Number(info.lastInsertRowid));
    logActivity(name, "مستخدم جديد سجّل في المنصة");
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    res.json({ user: publicUser(u) });
  });

  r.post("/provider-register", (req, res) => {
    const { type, name, email, password, phone = "" } = req.body || {};
    if (!["company", "guide"].includes(type)) return res.status(400).json({ error: "حدد نوع الحساب: شركة أو مرشد سياحي" });
    if (!name || !email || !password) return res.status(400).json({ error: "أكمل جميع الحقول" });
    if (String(password).length < 6) return res.status(400).json({ error: "كلمة المرور 6 أحرف على الأقل" });
    const exists = db.prepare("SELECT id FROM users WHERE email=?").get(String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: "هذا الإيميل مسجل مسبقاً" });
    const info = db
      .prepare(
        `INSERT INTO users (name,email,phone,password,role,created_at,last_active,email_verified)
         VALUES (?,?,?,?,'provider',?,?,1)`
      )
      .run(name, String(email).toLowerCase(), phone, hashPassword(password), now(), now());
    db.prepare("INSERT INTO providers (user_id,type,name,status,created_at) VALUES (?,?,?,?,?)").run(
      info.lastInsertRowid, type, name, "pending", now()
    );
    createSession(res, Number(info.lastInsertRowid));
    logActivity(name, type === "company" ? "شركة جديدة قدمت طلب انضمام" : "مرشد سياحي جديد قدم طلب انضمام");
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    res.json({ user: publicUser(u), providerStatus: "pending" });
  });

  r.post("/login", (req, res) => {
    const { email, password } = req.body || {};
    const u = db.prepare("SELECT * FROM users WHERE email=?").get(String(email || "").toLowerCase()) as any;
    const ok = !!u && verifyPassword(String(password || ""), u.password);
    db.prepare("INSERT INTO logins (email,user_id,ok,ip,created_at) VALUES (?,?,?,?,?)").run(
      String(email || "").toLowerCase(), u?.id ?? null, ok ? 1 : 0, req.ip || "", now()
    );
    if (!ok) return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    if (u.status === "banned") return res.status(403).json({ error: "هذا الحساب محظور" });
    if (u.status === "disabled") return res.status(403).json({ error: "هذا الحساب معطل" });
    createSession(res, u.id);
    res.json({ user: publicUser(u) });
  });

  r.post("/logout", (req, res) => {
    const cookie = req.headers.cookie || "";
    const match = cookie.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
    if (match) db.prepare("DELETE FROM sessions WHERE token=?").run(decodeURIComponent(match.split("=")[1] || ""));
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
    res.json({ ok: true });
  });

  r.get("/me", (req, res) => {
    if (!req.user) return res.json({ user: null });
    res.json({ user: req.user, provider: req.provider || null });
  });

  r.put("/profile", requireUser, (req, res) => {
    const { name, phone, city, gender, avatar } = req.body || {};
    const u = req.user!;
    db.prepare("UPDATE users SET name=?, phone=?, city=?, gender=?, avatar=? WHERE id=?").run(
      name ?? u.name, phone ?? u.phone, city ?? u.city, gender ?? u.gender, avatar ?? u.avatar, u.id
    );
    res.json({ ok: true });
  });

  r.put("/password", requireUser, (req, res) => {
    const { current, next: nextPass } = req.body || {};
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.user!.id) as any;
    if (!verifyPassword(String(current || ""), u.password))
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    if (String(nextPass || "").length < 6) return res.status(400).json({ error: "كلمة المرور الجديدة 6 أحرف على الأقل" });
    db.prepare("UPDATE users SET password=? WHERE id=?").run(hashPassword(nextPass), u.id);
    res.json({ ok: true });
  });

  return r;
}

import express, { type Router } from "express";
import { db, now, getSetting, setSetting, logActivity } from "./db.ts";
import { requireAdmin } from "./auth.ts";

const monthKey = (d: string) => d.slice(0, 7);
function last12Months(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function adminRouter(): Router {
  const r = express.Router();
  r.use(requireAdmin);
  r.use((req, res, next) => {
    if (req.user!.must_change_password) {
      return res.status(403).json({ error: "يجب تغيير كلمة المرور المؤقتة أولاً", mustChangePassword: true });
    }
    next();
  });

  // 1️⃣ لوحة المعلومات
  r.get("/overview", (_req, res) => {
    const kpis = {
      activeCompanies: (db.prepare("SELECT COUNT(*) c FROM providers WHERE status='active'").get() as any).c,
      totalUsers: (db.prepare("SELECT COUNT(*) c FROM users WHERE role='user'").get() as any).c,
      bookingsThisMonth: (db.prepare("SELECT COUNT(*) c FROM bookings WHERE substr(created_at,1,7)=?").get(monthKey(now())) as any).c,
      totalRevenue: (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE status='paid'").get() as any).s,
      satisfaction: (db.prepare("SELECT ROUND(AVG(rating),1) a FROM reviews").get() as any).a || 0,
      pendingComplaints: (db.prepare("SELECT COUNT(*) c FROM complaints WHERE status!='closed'").get() as any).c,
    };
    const months = last12Months();
    const bookingRows = db.prepare("SELECT substr(created_at,1,7) m, COUNT(*) c FROM bookings GROUP BY m").all() as any[];
    const userRows = db.prepare("SELECT substr(created_at,1,7) m, COUNT(*) c FROM users WHERE role='user' GROUP BY m").all() as any[];
    const revenueByCompany = db
      .prepare(
        `SELECT p.name, COALESCE(SUM(x.amount),0) s FROM transactions x JOIN providers p ON p.id=x.provider_id
         WHERE x.status='paid' GROUP BY p.id ORDER BY s DESC LIMIT 6`
      )
      .all();
    const recentCompanies = db.prepare("SELECT id,name,type,status,created_at FROM providers ORDER BY created_at DESC LIMIT 5").all();
    const recentBookings = db
      .prepare(
        `SELECT b.id, b.total, b.status, b.created_at, u.name user_name, t.title FROM bookings b
         JOIN users u ON u.id=b.user_id JOIN trips t ON t.id=b.trip_id ORDER BY b.created_at DESC LIMIT 5`
      )
      .all();
    const recentComplaints = db
      .prepare("SELECT c.id, c.type, c.priority, c.status, c.created_at, u.name user_name FROM complaints c JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 5")
      .all();
    res.json({
      kpis,
      bookingsTrend: months.map((m) => ({ m, c: bookingRows.find((x) => x.m === m)?.c || 0 })),
      usersTrend: months.map((m) => ({ m, c: userRows.find((x) => x.m === m)?.c || 0 })),
      revenueByCompany,
      recentCompanies, recentBookings, recentComplaints,
    });
  });

  // 2️⃣ إدارة الشركات
  r.get("/companies", (req, res) => {
    const { status, sort } = req.query as Record<string, string>;
    let sql = `
      SELECT p.*, u.email, u.phone, u.status AS user_status,
        (SELECT COUNT(*) FROM trips t WHERE t.provider_id=p.id AND t.status!='deleted') trips_count,
        (SELECT COALESCE(SUM(x.amount),0) FROM transactions x WHERE x.provider_id=p.id AND x.status='paid') revenue,
        (SELECT ROUND(AVG(r.rating),1) FROM reviews r JOIN trips t ON t.id=r.trip_id WHERE t.provider_id=p.id) rating
      FROM providers p JOIN users u ON u.id=p.user_id`;
    const params: any[] = [];
    if (status) { sql += " WHERE p.status=?"; params.push(status); }
    sql += sort === "revenue" ? " ORDER BY revenue DESC" : sort === "rating" ? " ORDER BY rating DESC" : " ORDER BY p.created_at DESC";
    const stats = {
      total: (db.prepare("SELECT COUNT(*) c FROM providers").get() as any).c,
      active: (db.prepare("SELECT COUNT(*) c FROM providers WHERE status='active'").get() as any).c,
      pending: (db.prepare("SELECT COUNT(*) c FROM providers WHERE status IN ('pending','suspended')").get() as any).c,
      banned: (db.prepare("SELECT COUNT(*) c FROM providers WHERE status='banned'").get() as any).c,
    };
    res.json({ stats, companies: db.prepare(sql).all(...params) });
  });

  r.put("/companies/:id", (req, res) => {
    const { status, name, license, bio } = req.body || {};
    const p = db.prepare("SELECT * FROM providers WHERE id=?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "غير موجود" });
    db.prepare("UPDATE providers SET status=?, name=?, license=?, bio=? WHERE id=?").run(
      status ?? p.status, name ?? p.name, license ?? p.license, bio ?? p.bio, p.id
    );
    if (status) logActivity("الأدمن", `تغيير حالة المزود ${p.name} إلى ${status}`);
    res.json({ ok: true });
  });

  r.delete("/companies/:id", (req, res) => {
    const p = db.prepare("SELECT * FROM providers WHERE id=?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "غير موجود" });
    db.prepare("UPDATE trips SET status='deleted' WHERE provider_id=?").run(p.id);
    db.prepare("DELETE FROM providers WHERE id=?").run(p.id);
    db.prepare("DELETE FROM users WHERE id=?").run(p.user_id);
    logActivity("الأدمن", `حذف المزود ${p.name}`);
    res.json({ ok: true });
  });

  // 3️⃣ إدارة المستخدمين
  r.get("/users", (req, res) => {
    const { status, q } = req.query as Record<string, string>;
    let sql = `
      SELECT u.id,u.name,u.email,u.phone,u.gender,u.city,u.status,u.created_at,u.last_active,
        (SELECT COUNT(*) FROM bookings b WHERE b.user_id=u.id) bookings_count
      FROM users u WHERE u.role='user'`;
    const params: any[] = [];
    if (status) { sql += " AND u.status=?"; params.push(status); }
    if (q) { sql += " AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    sql += " ORDER BY u.created_at DESC";
    const stats = {
      total: (db.prepare("SELECT COUNT(*) c FROM users WHERE role='user'").get() as any).c,
      active: (db.prepare("SELECT COUNT(*) c FROM users WHERE role='user' AND status='active'").get() as any).c,
      newThisMonth: (db.prepare("SELECT COUNT(*) c FROM users WHERE role='user' AND substr(created_at,1,7)=?").get(monthKey(now())) as any).c,
      banned: (db.prepare("SELECT COUNT(*) c FROM users WHERE role='user' AND status='banned'").get() as any).c,
    };
    res.json({ stats, users: db.prepare(sql).all(...params) });
  });

  r.put("/users/:id", (req, res) => {
    const { status, name, phone, city } = req.body || {};
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id) as any;
    if (!u) return res.status(404).json({ error: "غير موجود" });
    db.prepare("UPDATE users SET status=?, name=?, phone=?, city=? WHERE id=?").run(
      status ?? u.status, name ?? u.name, phone ?? u.phone, city ?? u.city, u.id
    );
    if (status) db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
    res.json({ ok: true });
  });

  r.delete("/users/:id", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(req.params.id);
    db.prepare("DELETE FROM users WHERE id=? AND role='user'").run(req.params.id);
    res.json({ ok: true });
  });

  r.post("/message", (req, res) => {
    const { userId, subject = "", body = "" } = req.body || {};
    const u = db.prepare("SELECT id FROM users WHERE id=?").get(userId);
    if (!u) return res.status(404).json({ error: "المستخدم غير موجود" });
    db.prepare("INSERT INTO messages (to_user_id,subject,body,created_at) VALUES (?,?,?,?)").run(userId, subject, body, now());
    res.json({ ok: true });
  });

  // 4️⃣ إدارة الحجوزات
  r.get("/bookings", (req, res) => {
    const { status, providerId } = req.query as Record<string, string>;
    let sql = `
      SELECT b.*, u.name user_name, t.title, p.name provider_name
      FROM bookings b JOIN users u ON u.id=b.user_id JOIN trips t ON t.id=b.trip_id JOIN providers p ON p.id=t.provider_id WHERE 1=1`;
    const params: any[] = [];
    if (status) { sql += " AND b.status=?"; params.push(status); }
    if (providerId) { sql += " AND p.id=?"; params.push(providerId); }
    sql += " ORDER BY b.created_at DESC LIMIT 300";
    const stats = {
      total: (db.prepare("SELECT COUNT(*) c FROM bookings").get() as any).c,
      confirmed: (db.prepare("SELECT COUNT(*) c FROM bookings WHERE status IN ('confirmed','completed')").get() as any).c,
      pending: (db.prepare("SELECT COUNT(*) c FROM bookings WHERE status='pending'").get() as any).c,
      cancelled: (db.prepare("SELECT COUNT(*) c FROM bookings WHERE status IN ('cancelled','refunded')").get() as any).c,
    };
    res.json({ stats, bookings: db.prepare(sql).all(...params) });
  });

  r.put("/bookings/:id", (req, res) => {
    const { status } = req.body || {};
    const b = db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id) as any;
    if (!b) return res.status(404).json({ error: "غير موجود" });
    db.prepare("UPDATE bookings SET status=? WHERE id=?").run(status, b.id);
    if (status === "refunded" || status === "cancelled")
      db.prepare("UPDATE transactions SET status='refunded' WHERE booking_id=?").run(b.id);
    if (status === "confirmed") {
      const tx = db.prepare("SELECT id FROM transactions WHERE booking_id=?").get(b.id);
      if (!tx) {
        const t = db.prepare("SELECT provider_id FROM trips WHERE id=?").get(b.trip_id) as any;
        db.prepare("INSERT INTO transactions (booking_id,provider_id,amount,fee,method,status,created_at) VALUES (?,?,?,?,?,'paid',?)")
          .run(b.id, t.provider_id, b.total, b.fee, b.payment_method, now());
      }
    }
    logActivity("الأدمن", `تحديث حجز #${b.id} إلى ${status}`);
    res.json({ ok: true });
  });

  // 5️⃣ الإيرادات والمالية
  r.get("/finance", (_req, res) => {
    const months = last12Months();
    const revRows = db.prepare("SELECT substr(created_at,1,7) m, SUM(amount) s, SUM(fee) f FROM transactions WHERE status='paid' GROUP BY m").all() as any[];
    const stats = {
      total: (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE status='paid'").get() as any).s,
      thisMonth: (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE status='paid' AND substr(created_at,1,7)=?").get(monthKey(now())) as any).s,
      pending: (db.prepare("SELECT COALESCE(SUM(total),0) s FROM bookings WHERE status='pending'").get() as any).s,
      netProfit: (db.prepare("SELECT COALESCE(SUM(fee),0) s FROM transactions WHERE status='paid'").get() as any).s,
    };
    const byCompany = db
      .prepare(
        `SELECT p.name, COALESCE(SUM(x.amount),0) s, COALESCE(SUM(x.fee),0) f FROM transactions x
         JOIN providers p ON p.id=x.provider_id WHERE x.status='paid' GROUP BY p.id ORDER BY s DESC`
      )
      .all();
    const byCategory = db
      .prepare(
        `SELECT t.category, COALESCE(SUM(b.total),0) s FROM bookings b JOIN trips t ON t.id=b.trip_id
         WHERE b.status IN ('confirmed','completed') GROUP BY t.category ORDER BY s DESC`
      )
      .all();
    const transactions = db
      .prepare(
        `SELECT x.*, p.name provider_name FROM transactions x LEFT JOIN providers p ON p.id=x.provider_id
         ORDER BY x.created_at DESC LIMIT 200`
      )
      .all();
    res.json({
      stats,
      trend: months.map((m) => {
        const row = revRows.find((x) => x.m === m);
        return { m, s: row?.s || 0, f: row?.f || 0 };
      }),
      byCompany, byCategory, transactions,
      payment: getSetting("payment", {}),
    });
  });

  // 6️⃣ التقييمات والشكاوى
  r.get("/quality", (_req, res) => {
    const stats = {
      avgRating: (db.prepare("SELECT ROUND(AVG(rating),1) a FROM reviews").get() as any).a || 0,
      totalReviews: (db.prepare("SELECT COUNT(*) c FROM reviews").get() as any).c,
      positive: (db.prepare("SELECT COUNT(*) c FROM reviews WHERE rating>=4").get() as any).c,
      negative: (db.prepare("SELECT COUNT(*) c FROM reviews WHERE rating<=2").get() as any).c,
      openComplaints: (db.prepare("SELECT COUNT(*) c FROM complaints WHERE status!='closed'").get() as any).c,
    };
    const reviews = db
      .prepare(
        `SELECT r.*, u.name user_name, t.title, p.name provider_name FROM reviews r
         JOIN users u ON u.id=r.user_id JOIN trips t ON t.id=r.trip_id JOIN providers p ON p.id=t.provider_id
         ORDER BY r.created_at DESC LIMIT 100`
      )
      .all();
    const complaints = db
      .prepare(
        `SELECT c.*, u.name user_name, p.name provider_name FROM complaints c
         JOIN users u ON u.id=c.user_id LEFT JOIN providers p ON p.id=c.provider_id
         ORDER BY CASE c.status WHEN 'new' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END, c.created_at DESC`
      )
      .all();
    res.json({ stats, reviews, complaints });
  });

  r.put("/complaints/:id", (req, res) => {
    const { status, priority, reply } = req.body || {};
    const c = db.prepare("SELECT * FROM complaints WHERE id=?").get(req.params.id) as any;
    if (!c) return res.status(404).json({ error: "غير موجود" });
    db.prepare("UPDATE complaints SET status=?, priority=?, reply=? WHERE id=?").run(
      status ?? c.status, priority ?? c.priority, reply ?? c.reply, c.id
    );
    res.json({ ok: true });
  });

  r.put("/reviews/:id", (req, res) => {
    const { reply, status } = req.body || {};
    const rev = db.prepare("SELECT * FROM reviews WHERE id=?").get(req.params.id) as any;
    if (!rev) return res.status(404).json({ error: "غير موجود" });
    db.prepare("UPDATE reviews SET reply=?, status=? WHERE id=?").run(reply ?? rev.reply, status ?? rev.status, rev.id);
    res.json({ ok: true });
  });

  // 7️⃣ إدارة المحتوى والرحلات
  r.get("/content", (_req, res) => {
    const stats = {
      totalTrips: (db.prepare("SELECT COUNT(*) c FROM trips WHERE status!='deleted'").get() as any).c,
      activeTrips: (db.prepare("SELECT COUNT(*) c FROM trips WHERE status='active'").get() as any).c,
      pendingTrips: (db.prepare("SELECT COUNT(*) c FROM trips WHERE status IN ('pending','hidden')").get() as any).c,
      deletedTrips: (db.prepare("SELECT COUNT(*) c FROM trips WHERE status='deleted'").get() as any).c,
    };
    const trips = db
      .prepare(
        `SELECT t.*, p.name provider_name,
          (SELECT COUNT(*) FROM bookings b WHERE b.trip_id=t.id) bookings_count,
          (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.trip_id=t.id) rating
         FROM trips t JOIN providers p ON p.id=t.provider_id WHERE t.status!='deleted' ORDER BY t.sort, t.id`
      )
      .all();
    const ads = db.prepare("SELECT * FROM ads ORDER BY sort").all();
    const contents = db.prepare("SELECT * FROM contents ORDER BY created_at DESC").all();
    res.json({ stats, trips, ads, contents });
  });

  r.put("/trips/:id", (req, res) => {
    const t = db.prepare("SELECT * FROM trips WHERE id=?").get(req.params.id) as any;
    if (!t) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE trips SET status=?, featured=?, weekend_offer=?, sort=?, title=?, price=?, image=? WHERE id=?").run(
      b.status ?? t.status, b.featured ?? t.featured, b.weekendOffer ?? t.weekend_offer,
      b.sort ?? t.sort, b.title ?? t.title, b.price ?? t.price, b.image ?? t.image, t.id
    );
    res.json({ ok: true });
  });

  r.delete("/trips/:id", (req, res) => {
    db.prepare("UPDATE trips SET status='deleted' WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  r.post("/ads", (req, res) => {
    const { title = "", subtitle = "", image = "/scenes/dunes-sunset.svg", link = "" } = req.body || {};
    if (!title) return res.status(400).json({ error: "العنوان مطلوب" });
    const max = (db.prepare("SELECT COALESCE(MAX(sort),0) m FROM ads").get() as any).m;
    const info = db.prepare("INSERT INTO ads (title,subtitle,image,link,sort,active) VALUES (?,?,?,?,?,1)").run(title, subtitle, image, link, max + 1);
    res.json({ id: Number(info.lastInsertRowid) });
  });

  r.put("/ads/:id", (req, res) => {
    const ad = db.prepare("SELECT * FROM ads WHERE id=?").get(req.params.id) as any;
    if (!ad) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE ads SET title=?, subtitle=?, image=?, link=?, sort=?, active=? WHERE id=?").run(
      b.title ?? ad.title, b.subtitle ?? ad.subtitle, b.image ?? ad.image, b.link ?? ad.link,
      b.sort ?? ad.sort, b.active ?? ad.active, ad.id
    );
    res.json({ ok: true });
  });

  r.delete("/ads/:id", (req, res) => {
    db.prepare("DELETE FROM ads WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  r.post("/contents", (req, res) => {
    const { kind = "article", title = "", body = "", image = "/scenes/oasis.svg", author = "فريق نُزه" } = req.body || {};
    if (!title) return res.status(400).json({ error: "العنوان مطلوب" });
    const info = db.prepare("INSERT INTO contents (kind,title,body,image,author,created_at) VALUES (?,?,?,?,?,?)").run(kind, title, body, image, author, now());
    res.json({ id: Number(info.lastInsertRowid) });
  });

  r.put("/contents/:id", (req, res) => {
    const c = db.prepare("SELECT * FROM contents WHERE id=?").get(req.params.id) as any;
    if (!c) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE contents SET kind=?, title=?, body=?, image=?, author=?, status=? WHERE id=?").run(
      b.kind ?? c.kind, b.title ?? c.title, b.body ?? c.body, b.image ?? c.image, b.author ?? c.author, b.status ?? c.status, c.id
    );
    res.json({ ok: true });
  });

  r.delete("/contents/:id", (req, res) => {
    db.prepare("DELETE FROM contents WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  // 8️⃣ الترويجات والعروض
  r.get("/promotions", (_req, res) => {
    res.json({ promotions: db.prepare("SELECT * FROM promotions ORDER BY id DESC").all() });
  });

  r.post("/promotions", (req, res) => {
    const { name, code, kind = "percent", value, starts, ends, maxUses = 100 } = req.body || {};
    if (!name || !code || !value || !starts || !ends) return res.status(400).json({ error: "أكمل جميع الحقول" });
    try {
      const info = db.prepare("INSERT INTO promotions (name,code,kind,value,starts,ends,max_uses,used,active) VALUES (?,?,?,?,?,?,?,0,1)")
        .run(name, String(code).toUpperCase(), kind, value, starts, ends, maxUses);
      res.json({ id: Number(info.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: "الكود مستخدم مسبقاً" });
    }
  });

  r.put("/promotions/:id", (req, res) => {
    const p = db.prepare("SELECT * FROM promotions WHERE id=?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE promotions SET name=?, kind=?, value=?, starts=?, ends=?, max_uses=?, active=? WHERE id=?").run(
      b.name ?? p.name, b.kind ?? p.kind, b.value ?? p.value, b.starts ?? p.starts, b.ends ?? p.ends,
      b.maxUses ?? p.max_uses, b.active ?? p.active, p.id
    );
    res.json({ ok: true });
  });

  r.delete("/promotions/:id", (req, res) => {
    db.prepare("DELETE FROM promotions WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  // 9️⃣ التقارير والتحليلات
  r.get("/reports/:type", (req, res) => {
    const type = req.params.type;
    const { from = "0000", to = "9999" } = req.query as Record<string, string>;
    let rows: any[] = [];
    let title = "";
    if (type === "monthly") {
      title = "تقرير الأداء الشهري";
      rows = db.prepare(
        `SELECT substr(b.created_at,1,7) الشهر, COUNT(*) الحجوزات,
           SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total ELSE 0 END) الإيرادات,
           SUM(CASE WHEN b.status IN ('cancelled','refunded') THEN 1 ELSE 0 END) الإلغاءات
         FROM bookings b WHERE b.created_at BETWEEN ? AND ? GROUP BY substr(b.created_at,1,7) ORDER BY 1 DESC`
      ).all(from, to + "￿");
    } else if (type === "top-companies") {
      title = "تقرير الشركات الأفضل";
      rows = db.prepare(
        `SELECT p.name الشركة, COUNT(b.id) الحجوزات, COALESCE(SUM(x.amount),0) الإيرادات,
           COALESCE((SELECT ROUND(AVG(r.rating),1) FROM reviews r JOIN trips t2 ON t2.id=r.trip_id WHERE t2.provider_id=p.id),0) التقييم
         FROM providers p
         LEFT JOIN trips t ON t.provider_id=p.id LEFT JOIN bookings b ON b.trip_id=t.id AND b.created_at BETWEEN ? AND ?
         LEFT JOIN transactions x ON x.booking_id=b.id AND x.status='paid'
         GROUP BY p.id ORDER BY الإيرادات DESC`
      ).all(from, to + "￿");
    } else if (type === "top-users") {
      title = "تقرير المستخدمين الأكثر نشاطاً";
      rows = db.prepare(
        `SELECT u.name الاسم, u.email الإيميل, COUNT(b.id) الحجوزات, COALESCE(SUM(b.total),0) الإنفاق
         FROM users u JOIN bookings b ON b.user_id=u.id AND b.created_at BETWEEN ? AND ?
         WHERE u.role='user' GROUP BY u.id ORDER BY الحجوزات DESC LIMIT 20`
      ).all(from, to + "￿");
    } else if (type === "top-trips") {
      title = "تقرير الرحلات الأكثر حجزاً";
      rows = db.prepare(
        `SELECT t.title الرحلة, p.name الشركة, COUNT(b.id) الحجوزات, COALESCE(SUM(b.total),0) الإيرادات,
           COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.trip_id=t.id),0) التقييم
         FROM trips t JOIN providers p ON p.id=t.provider_id
         LEFT JOIN bookings b ON b.trip_id=t.id AND b.created_at BETWEEN ? AND ?
         GROUP BY t.id ORDER BY الحجوزات DESC LIMIT 20`
      ).all(from, to + "￿");
    } else if (type === "complaints") {
      title = "تقرير الشكاوى والمشاكل";
      rows = db.prepare(
        `SELECT c.type النوع, c.priority الأولوية, c.status الحالة, u.name المستخدم, COALESCE(p.name,'—') الشركة, substr(c.created_at,1,10) التاريخ
         FROM complaints c JOIN users u ON u.id=c.user_id LEFT JOIN providers p ON p.id=c.provider_id
         WHERE c.created_at BETWEEN ? AND ? ORDER BY c.created_at DESC`
      ).all(from, to + "￿");
    } else {
      return res.status(404).json({ error: "نوع تقرير غير معروف" });
    }
    if ((req.query as any).format === "csv") {
      const headers = rows.length ? Object.keys(rows[0]) : [];
      const csv = "﻿" + [headers.join(","), ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${type}.csv"`);
      return res.send(csv);
    }
    res.json({ title, rows });
  });

  // 🔟 الإعدادات والأمان
  r.get("/settings", (_req, res) => {
    res.json({
      general: getSetting("general", {}),
      payment: getSetting("payment", {}),
      security: getSetting("security", {}),
      staff: db.prepare("SELECT * FROM staff ORDER BY id").all(),
      logins: db.prepare("SELECT * FROM logins ORDER BY created_at DESC LIMIT 50").all(),
      suspicious: db.prepare("SELECT email, COUNT(*) attempts, MAX(created_at) last FROM logins WHERE ok=0 GROUP BY email HAVING attempts>=3 ORDER BY attempts DESC").all(),
      activity: db.prepare("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50").all(),
    });
  });

  r.put("/settings/:key", (req, res) => {
    if (!["general", "payment", "security", "about", "faq", "userGuide", "platformAchievements", "map"].includes(req.params.key))
      return res.status(400).json({ error: "مفتاح غير معروف" });
    setSetting(req.params.key, req.body);
    logActivity("الأدمن", `تحديث إعدادات ${req.params.key}`);
    res.json({ ok: true });
  });

  // ---------- المحميات والخريطة التفاعلية ----------
  r.get("/reserves", (_req, res) => {
    const reserves = (db.prepare("SELECT * FROM reserves ORDER BY id").all() as any[]).map((x) => ({
      ...x, animals: JSON.parse(x.animals || "[]"), zones: JSON.parse(x.zones || "[]"),
    }));
    res.json({ reserves, map: getSetting("map", { style: "satellite" }) });
  });

  function parseReserveBody(b: any) {
    const zones = Array.isArray(b.zones) ? b.zones : [];
    for (const z of zones) {
      if (!z.name || !["allowed", "permit", "forbidden"].includes(z.type) || !Array.isArray(z.polygon) || z.polygon.length < 3)
        throw new Error("كل منطقة تحتاج: اسم، تصنيف (allowed/permit/forbidden)، ومضلع من 3 نقاط على الأقل");
    }
    return {
      name: String(b.name || "").trim(),
      description: String(b.description || ""),
      area_km2: Number(b.area_km2) || 0,
      animals: JSON.stringify(Array.isArray(b.animals) ? b.animals : []),
      center_lat: Number(b.center_lat) || 24.9,
      center_lng: Number(b.center_lng) || 46.6,
      zoom: Number(b.zoom) || 8,
      zones: JSON.stringify(zones),
      visitors: Number(b.visitors) || 0,
      best_time: String(b.best_time || ""),
    };
  }

  r.post("/reserves", (req, res) => {
    try {
      const v = parseReserveBody(req.body || {});
      if (!v.name) return res.status(400).json({ error: "اسم المحمية مطلوب" });
      const info = db.prepare(
        "INSERT INTO reserves (name,description,area_km2,animals,center_lat,center_lng,zoom,zones,visitors,best_time) VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).run(v.name, v.description, v.area_km2, v.animals, v.center_lat, v.center_lng, v.zoom, v.zones, v.visitors, v.best_time);
      logActivity("الأدمن", `أضاف محمية: ${v.name}`);
      res.json({ id: Number(info.lastInsertRowid) });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  r.put("/reserves/:id", (req, res) => {
    const cur = db.prepare("SELECT * FROM reserves WHERE id=?").get(req.params.id) as any;
    if (!cur) return res.status(404).json({ error: "المحمية غير موجودة" });
    try {
      const b = { ...cur, animals: JSON.parse(cur.animals || "[]"), zones: JSON.parse(cur.zones || "[]"), ...(req.body || {}) };
      const v = parseReserveBody(b);
      db.prepare(
        "UPDATE reserves SET name=?,description=?,area_km2=?,animals=?,center_lat=?,center_lng=?,zoom=?,zones=?,visitors=?,best_time=? WHERE id=?"
      ).run(v.name, v.description, v.area_km2, v.animals, v.center_lat, v.center_lng, v.zoom, v.zones, v.visitors, v.best_time, cur.id);
      logActivity("الأدمن", `حدّث محمية: ${v.name}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  r.delete("/reserves/:id", (req, res) => {
    const cur = db.prepare("SELECT name FROM reserves WHERE id=?").get(req.params.id) as any;
    if (!cur) return res.status(404).json({ error: "المحمية غير موجودة" });
    db.prepare("DELETE FROM reserves WHERE id=?").run(req.params.id);
    logActivity("الأدمن", `حذف محمية: ${cur.name}`);
    res.json({ ok: true });
  });

  // ---------- الشركاء ----------
  r.get("/partners", (_req, res) => {
    res.json({ partners: db.prepare("SELECT * FROM partners ORDER BY sort").all() });
  });

  r.post("/partners", (req, res) => {
    const { name, kind = "شريك نجاح", logo = "", sort = 0 } = req.body || {};
    if (!name) return res.status(400).json({ error: "اسم الشريك مطلوب" });
    const info = db.prepare("INSERT INTO partners (name,kind,logo,sort) VALUES (?,?,?,?)").run(name, kind, logo, sort);
    logActivity("الأدمن", `أضاف شريكاً: ${name}`);
    res.json({ id: Number(info.lastInsertRowid) });
  });

  r.put("/partners/:id", (req, res) => {
    const p = db.prepare("SELECT * FROM partners WHERE id=?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE partners SET name=?, kind=?, logo=?, sort=? WHERE id=?").run(b.name ?? p.name, b.kind ?? p.kind, b.logo ?? p.logo, b.sort ?? p.sort, p.id);
    res.json({ ok: true });
  });

  r.delete("/partners/:id", (req, res) => {
    db.prepare("DELETE FROM partners WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  // ---------- كتالوج الإنجازات ----------
  r.get("/achievements", (_req, res) => {
    res.json({ achievements: db.prepare("SELECT * FROM achievements ORDER BY id").all() });
  });

  r.post("/achievements", (req, res) => {
    const { code, title, description = "", icon = "🏅", metric, target = 1 } = req.body || {};
    if (!code || !title || !metric) return res.status(400).json({ error: "أكمل: الكود، العنوان، والمقياس" });
    const exists = db.prepare("SELECT id FROM achievements WHERE code=?").get(code);
    if (exists) return res.status(409).json({ error: "هذا الكود مستخدم مسبقاً" });
    const info = db.prepare("INSERT INTO achievements (code,title,description,icon,metric,target) VALUES (?,?,?,?,?,?)").run(code, title, description, icon, metric, Number(target) || 1);
    logActivity("الأدمن", `أضاف إنجازاً: ${title}`);
    res.json({ id: Number(info.lastInsertRowid) });
  });

  r.put("/achievements/:id", (req, res) => {
    const a = db.prepare("SELECT * FROM achievements WHERE id=?").get(req.params.id) as any;
    if (!a) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE achievements SET title=?, description=?, icon=?, metric=?, target=? WHERE id=?").run(
      b.title ?? a.title, b.description ?? a.description, b.icon ?? a.icon, b.metric ?? a.metric, Number(b.target ?? a.target) || 1, a.id
    );
    res.json({ ok: true });
  });

  r.delete("/achievements/:id", (req, res) => {
    db.prepare("DELETE FROM achievements WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  r.post("/staff", (req, res) => {
    const { name, email, role = "مشرف" } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: "أكمل الاسم والإيميل" });
    const info = db.prepare("INSERT INTO staff (name,email,role,active,created_at) VALUES (?,?,?,1,?)").run(name, email, role, now());
    res.json({ id: Number(info.lastInsertRowid) });
  });

  r.put("/staff/:id", (req, res) => {
    const s = db.prepare("SELECT * FROM staff WHERE id=?").get(req.params.id) as any;
    if (!s) return res.status(404).json({ error: "غير موجود" });
    const b = req.body || {};
    db.prepare("UPDATE staff SET name=?, email=?, role=?, active=? WHERE id=?").run(b.name ?? s.name, b.email ?? s.email, b.role ?? s.role, b.active ?? s.active, s.id);
    res.json({ ok: true });
  });

  r.delete("/staff/:id", (req, res) => {
    db.prepare("DELETE FROM staff WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });

  r.get("/backup", (_req, res) => {
    const tables = ["users", "providers", "reserves", "trips", "bookings", "reviews", "complaints", "ads", "contents", "permits", "promotions", "achievements", "partners", "transactions", "staff", "settings"];
    const dump: Record<string, any[]> = {};
    for (const t of tables) dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
    res.setHeader("Content-Disposition", `attachment; filename="nuzh-backup-${now().slice(0, 10)}.json"`);
    res.json({ exportedAt: now(), tables: dump });
  });

  return r;
}

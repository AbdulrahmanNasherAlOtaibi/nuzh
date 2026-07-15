import express, { type Router } from "express";
import { db, now, getSetting, logActivity } from "./db.ts";
import { requireUser, requireProvider } from "./auth.ts";

const TRIP_SELECT = `
  SELECT t.*, p.name AS provider_name, p.type AS provider_type,
    COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.trip_id=t.id AND r.status='published'),0) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.trip_id=t.id AND r.status='published') AS reviews_count,
    (SELECT COUNT(*) FROM bookings b WHERE b.trip_id=t.id AND b.status IN ('confirmed','completed')) AS bookings_count
  FROM trips t JOIN providers p ON p.id=t.provider_id`;

function tripRow(t: any) {
  return { ...t, dates: JSON.parse(t.dates || "[]") };
}

export function computeUserStats(userId: number) {
  const completed = db
    .prepare(
      `SELECT b.*, t.distance_km, t.category, t.reserve_id, t.title FROM bookings b JOIN trips t ON t.id=b.trip_id
       WHERE b.user_id=? AND b.status='completed'`
    )
    .all(userId) as any[];
  const allBookings = db.prepare("SELECT * FROM bookings WHERE user_id=? AND status!='cancelled'").all(userId) as any[];
  const reviews = db.prepare("SELECT COUNT(*) c FROM reviews WHERE user_id=?").get(userId) as { c: number };
  const photos = allBookings.reduce((n, b) => n + JSON.parse(b.photos || "[]").length, 0);
  const distance = completed.reduce((n, b) => n + (b.distance_km || 0), 0);
  const reserves = new Set(completed.map((b) => b.reserve_id).filter(Boolean)).size;
  const categories = new Set(completed.map((b) => b.category)).size;
  const withChildren = allBookings.some((b) => b.children > 0) ? 1 : 0;
  const early = allBookings.some((b) => (new Date(b.date).getTime() - new Date(b.created_at).getTime()) / 864e5 >= 14) ? 1 : 0;

  // الرحلة المفضلة: الأكثر تكراراً في الحجوزات المكتملة
  const freq = new Map<string, number>();
  for (const b of completed) freq.set(b.title, (freq.get(b.title) || 0) + 1);
  const favorite = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  // تقييم صاحب الحساب من 5 نجوم بناءً على نشاطه
  const score = Math.min(5, +(1 + completed.length * 0.35 + reviews.c * 0.25 + photos * 0.1 + reserves * 0.3).toFixed(1));

  const metrics: Record<string, number> = {
    trips: completed.length,
    distance: Math.round(distance),
    reviews: reviews.c,
    photos,
    reserves,
    children: withChildren,
    early,
    categories,
    articles: 0, // يُحتسب من جهة العميل عبر القراءة — قيمة تحفيزية
  };
  return { completedCount: completed.length, distance: Math.round(distance), favorite, score, metrics };
}

export function apiRouter(): Router {
  const r = express.Router();

  // ---------- عام ----------
  r.get("/home", (_req, res) => {
    const ads = db.prepare("SELECT * FROM ads WHERE active=1 ORDER BY sort LIMIT 6").all();
    const active = "t.status='active'";
    const loved = (db.prepare(`${TRIP_SELECT} WHERE ${active} ORDER BY bookings_count DESC LIMIT 6`).all() as any[]).map(tripRow);
    const topRated = (db.prepare(`${TRIP_SELECT} WHERE ${active} ORDER BY rating DESC, reviews_count DESC LIMIT 6`).all() as any[]).map(tripRow);
    const weekend = (db.prepare(`${TRIP_SELECT} WHERE ${active} AND t.weekend_offer=1 ORDER BY t.sort LIMIT 6`).all() as any[]).map(tripRow);
    const partners = db.prepare("SELECT * FROM partners ORDER BY sort").all();
    res.json({ ads, loved, topRated, weekend, partners });
  });

  r.get("/trips", (req, res) => {
    const { category, q, filter, sort } = req.query as Record<string, string>;
    let sql = `${TRIP_SELECT} WHERE t.status='active'`;
    const params: any[] = [];
    if (category) { sql += " AND t.category=?"; params.push(category); }
    if (filter === "weekend") sql += " AND t.weekend_offer=1";
    if (q) { sql += " AND (t.title LIKE ? OR t.description LIKE ? OR t.location LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    sql += sort === "price" ? " ORDER BY t.price" : sort === "rating" ? " ORDER BY rating DESC" : " ORDER BY t.sort";
    res.json({ trips: (db.prepare(sql).all(...params) as any[]).map(tripRow) });
  });

  r.get("/trips/:id", (req, res) => {
    const t = db.prepare(`${TRIP_SELECT} WHERE t.id=?`).get(req.params.id) as any;
    if (!t || t.status === "deleted") return res.status(404).json({ error: "الرحلة غير موجودة" });
    const reviews = db
      .prepare(
        `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id=r.user_id
         WHERE r.trip_id=? AND r.status='published' ORDER BY r.created_at DESC LIMIT 20`
      )
      .all(t.id);
    const reserve = t.reserve_id ? db.prepare("SELECT id,name,best_time,visitors FROM reserves WHERE id=?").get(t.reserve_id) : null;
    res.json({ trip: tripRow(t), reviews, reserve });
  });

  r.get("/reserves", (_req, res) => {
    const reserves = (db.prepare("SELECT * FROM reserves").all() as any[]).map((x) => ({
      ...x, animals: JSON.parse(x.animals || "[]"), zones: JSON.parse(x.zones || "[]"),
    }));
    res.json({ reserves });
  });

  r.get("/content", (req, res) => {
    const { kind } = req.query as Record<string, string>;
    let sql = "SELECT * FROM contents WHERE status='active'";
    const params: any[] = [];
    if (kind) { sql += " AND kind=?"; params.push(kind); }
    sql += " ORDER BY created_at DESC";
    res.json({ items: db.prepare(sql).all(...params) });
  });

  r.get("/content/:id", (req, res) => {
    const item = db.prepare("SELECT * FROM contents WHERE id=?").get(req.params.id);
    if (!item) return res.status(404).json({ error: "غير موجود" });
    res.json({ item });
  });

  r.get("/public-settings", (_req, res) => {
    res.json({
      general: getSetting("general", {}),
      map: getSetting("map", { style: "satellite" }),
      about: getSetting("about", ""),
      faq: getSetting("faq", []),
      userGuide: getSetting("userGuide", []),
      platformAchievements: getSetting("platformAchievements", []),
      partners: db.prepare("SELECT * FROM partners ORDER BY sort").all(),
    });
  });

  r.post("/promo/validate", (req, res) => {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const p = db.prepare("SELECT * FROM promotions WHERE UPPER(code)=? AND active=1").get(code) as any;
    const today = now().slice(0, 10);
    if (!p || p.starts > today || p.ends < today || p.used >= p.max_uses)
      return res.status(404).json({ error: "الكود غير صالح أو منتهي" });
    res.json({ promo: { code: p.code, kind: p.kind, value: p.value, name: p.name } });
  });

  // ---------- الحجز ----------
  r.post("/bookings", requireUser, (req, res) => {
    const { tripId, date, adults = 1, children = 0, notes = "", paymentMethod = "mada", promoCode = "" } = req.body || {};
    const t = db.prepare("SELECT * FROM trips WHERE id=? AND status='active'").get(tripId) as any;
    if (!t) return res.status(404).json({ error: "الرحلة غير متاحة" });
    if (!date) return res.status(400).json({ error: "اختر تاريخ الرحلة" });
    const nAdults = Math.max(1, Number(adults));
    const nChildren = Math.max(0, Number(children));
    let total = nAdults * t.price + nChildren * (t.child_price || Math.round(t.price / 2));
    let promo = "";
    if (promoCode) {
      const p = db.prepare("SELECT * FROM promotions WHERE UPPER(code)=UPPER(?) AND active=1").get(promoCode) as any;
      const today = now().slice(0, 10);
      if (p && p.starts <= today && p.ends >= today && p.used < p.max_uses) {
        total = p.kind === "percent" ? Math.round(total * (1 - p.value / 100)) : Math.max(0, total - p.value);
        promo = p.code;
        db.prepare("UPDATE promotions SET used=used+1 WHERE id=?").run(p.id);
      }
    }
    const feePercent = (getSetting("payment", { feePercent: 10 }) as any).feePercent ?? 10;
    const fee = Math.round((total * feePercent) / 100);
    const info = db
      .prepare(
        `INSERT INTO bookings (trip_id,user_id,date,adults,children,notes,total,fee,payment_method,promo_code,status,photos,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,'confirmed','[]',?)`
      )
      .run(t.id, req.user!.id, date, nAdults, nChildren, notes, total, fee, paymentMethod, promo, now());
    db.prepare("INSERT INTO transactions (booking_id,provider_id,amount,fee,method,status,created_at) VALUES (?,?,?,?,?,'paid',?)")
      .run(Number(info.lastInsertRowid), t.provider_id, total, fee, paymentMethod, now());
    logActivity(req.user!.name, `حجز جديد: ${t.title}`);
    res.json({ bookingId: Number(info.lastInsertRowid), total, fee });
  });

  r.get("/my/bookings", requireUser, (req, res) => {
    const rows = db
      .prepare(
        `SELECT b.*, t.title, t.image, t.location, t.category, t.duration_hours, t.distance_km, p.name AS provider_name,
           (SELECT r.rating FROM reviews r WHERE r.booking_id=b.id) AS my_rating
         FROM bookings b JOIN trips t ON t.id=b.trip_id JOIN providers p ON p.id=t.provider_id
         WHERE b.user_id=? ORDER BY b.date DESC`
      )
      .all(req.user!.id) as any[];
    const today = now().slice(0, 10);
    const parse = (b: any) => ({ ...b, photos: JSON.parse(b.photos || "[]") });
    res.json({
      upcoming: rows.filter((b) => b.date >= today && ["pending", "confirmed"].includes(b.status)).map(parse).reverse(),
      past: rows.filter((b) => b.date < today || ["completed", "cancelled", "refunded"].includes(b.status)).map(parse),
    });
  });

  r.post("/my/bookings/:id/photos", requireUser, (req, res) => {
    const b = db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id, req.user!.id) as any;
    if (!b) return res.status(404).json({ error: "الحجز غير موجود" });
    const photo = String(req.body?.photo || "");
    if (!photo.startsWith("data:image/")) return res.status(400).json({ error: "صيغة الصورة غير صالحة" });
    if (photo.length > 2_500_000) return res.status(400).json({ error: "الصورة كبيرة جداً" });
    const photos = JSON.parse(b.photos || "[]");
    if (photos.length >= 6) return res.status(400).json({ error: "الحد الأقصى 6 صور لكل رحلة" });
    photos.push(photo);
    db.prepare("UPDATE bookings SET photos=? WHERE id=?").run(JSON.stringify(photos), b.id);
    res.json({ ok: true, count: photos.length });
  });

  r.post("/my/bookings/:id/cancel", requireUser, (req, res) => {
    const b = db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(req.params.id, req.user!.id) as any;
    if (!b) return res.status(404).json({ error: "الحجز غير موجود" });
    if (!["pending", "confirmed"].includes(b.status)) return res.status(400).json({ error: "لا يمكن إلغاء هذا الحجز" });
    db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
    db.prepare("UPDATE transactions SET status='refunded' WHERE booking_id=?").run(b.id);
    logActivity(req.user!.name, `إلغاء حجز #${b.id}`);
    res.json({ ok: true });
  });

  // التقييم متاح فقط لمن أكمل رحلة محجوزة فعلياً — منع التقييم الوهمي
  r.post("/reviews", requireUser, (req, res) => {
    const { bookingId, rating, text = "" } = req.body || {};
    const b = db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=?").get(bookingId, req.user!.id) as any;
    if (!b) return res.status(404).json({ error: "الحجز غير موجود" });
    if (b.status !== "completed") return res.status(400).json({ error: "التقييم متاح بعد اكتمال الرحلة فقط" });
    const exists = db.prepare("SELECT id FROM reviews WHERE booking_id=?").get(bookingId);
    if (exists) return res.status(409).json({ error: "قيّمت هذه الرحلة مسبقاً" });
    const stars = Math.min(5, Math.max(1, Number(rating)));
    db.prepare("INSERT INTO reviews (booking_id,trip_id,user_id,rating,text,status,created_at) VALUES (?,?,?,?,?,'published',?)")
      .run(b.id, b.trip_id, req.user!.id, stars, String(text).slice(0, 1000), now());
    logActivity(req.user!.name, `تقييم جديد ${stars}⭐`);
    res.json({ ok: true });
  });

  r.get("/my/stats", requireUser, (req, res) => {
    const stats = computeUserStats(req.user!.id);
    const achievements = (db.prepare("SELECT * FROM achievements ORDER BY id").all() as any[]).map((a) => {
      const progress = Math.min(a.target, stats.metrics[a.metric] ?? 0);
      return { ...a, progress, unlocked: progress >= a.target };
    });
    res.json({ ...stats, achievements });
  });

  // ---------- التصاريح ----------
  r.get("/my/permits", requireUser, (req, res) => {
    const permits = db
      .prepare(
        `SELECT p.*, r.name AS reserve_name FROM permits p JOIN reserves r ON r.id=p.reserve_id
         WHERE p.user_id=? ORDER BY p.created_at DESC`
      )
      .all(req.user!.id);
    res.json({ permits });
  });

  r.post("/my/permits", requireUser, (req, res) => {
    const { reserveId, from, to } = req.body || {};
    const reserve = db.prepare("SELECT id FROM reserves WHERE id=?").get(reserveId);
    if (!reserve) return res.status(404).json({ error: "المحمية غير موجودة" });
    if (!from || !to) return res.status(400).json({ error: "حدد فترة التصريح" });
    const permitNo = String(10000 + Math.floor(Math.random() * 90000));
    db.prepare("INSERT INTO permits (user_id,reserve_id,permit_no,from_date,to_date,status,created_at) VALUES (?,?,?,?,?,'review',?)")
      .run(req.user!.id, reserveId, permitNo, from, to, now());
    logActivity(req.user!.name, `طلب تصريح جديد #${permitNo}`);
    res.json({ ok: true, permitNo });
  });

  r.get("/my/messages", requireUser, (req, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE to_user_id=? ORDER BY created_at DESC").all(req.user!.id);
    db.prepare("UPDATE messages SET read=1 WHERE to_user_id=?").run(req.user!.id);
    res.json({ messages });
  });

  // ---------- بوابة مزودي الخدمة ----------
  r.get("/provider/summary", requireProvider, (req, res) => {
    const pid = req.provider!.id;
    const trips = db.prepare("SELECT COUNT(*) c FROM trips WHERE provider_id=? AND status!='deleted'").get(pid) as any;
    const bookings = db
      .prepare(
        `SELECT COUNT(*) c, COALESCE(SUM(CASE WHEN b.status IN ('confirmed','completed') THEN b.total ELSE 0 END),0) revenue
         FROM bookings b JOIN trips t ON t.id=b.trip_id WHERE t.provider_id=?`
      )
      .get(pid) as any;
    const rating = db
      .prepare("SELECT ROUND(AVG(r.rating),1) avg FROM reviews r JOIN trips t ON t.id=r.trip_id WHERE t.provider_id=?")
      .get(pid) as any;
    res.json({
      provider: req.provider,
      trips: trips.c, bookings: bookings.c, revenue: bookings.revenue, rating: rating.avg || 0,
    });
  });

  r.get("/provider/trips", requireProvider, (req, res) => {
    const trips = (db.prepare(`${TRIP_SELECT} WHERE t.provider_id=? AND t.status!='deleted' ORDER BY t.created_at DESC`).all(req.provider!.id) as any[]).map(tripRow);
    res.json({ trips });
  });

  r.post("/provider/trips", requireProvider, (req, res) => {
    const { title, description = "", category, location = "", price, childPrice = 0, durationHours = 4, distanceKm = 0, capacity = 20, image = "/scenes/dunes-sunset.svg", dates = [], weekendOffer = 0, reserveId = null } = req.body || {};
    if (!title || !category || !price) return res.status(400).json({ error: "أكمل اسم الرحلة والتصنيف والسعر" });
    const info = db
      .prepare(
        `INSERT INTO trips (provider_id,reserve_id,title,description,category,location,price,child_price,duration_hours,distance_km,capacity,image,dates,status,weekend_offer,featured,sort,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,0,999,?)`
      )
      .run(req.provider!.id, reserveId, title, description, category, location, price, childPrice, durationHours, distanceKm, capacity, image, JSON.stringify(dates), weekendOffer ? 1 : 0, now());
    logActivity(req.provider!.name, `رحلة جديدة بانتظار الاعتماد: ${title}`);
    res.json({ id: Number(info.lastInsertRowid), status: "pending" });
  });

  r.put("/provider/trips/:id", requireProvider, (req, res) => {
    const t = db.prepare("SELECT * FROM trips WHERE id=? AND provider_id=?").get(req.params.id, req.provider!.id) as any;
    if (!t) return res.status(404).json({ error: "الرحلة غير موجودة" });
    const b = req.body || {};
    db.prepare(
      `UPDATE trips SET title=?, description=?, category=?, location=?, price=?, child_price=?, duration_hours=?, distance_km=?, capacity=?, image=?, dates=?, weekend_offer=? WHERE id=?`
    ).run(
      b.title ?? t.title, b.description ?? t.description, b.category ?? t.category, b.location ?? t.location,
      b.price ?? t.price, b.childPrice ?? t.child_price, b.durationHours ?? t.duration_hours, b.distanceKm ?? t.distance_km,
      b.capacity ?? t.capacity, b.image ?? t.image, JSON.stringify(b.dates ?? JSON.parse(t.dates || "[]")),
      (b.weekendOffer ?? t.weekend_offer) ? 1 : 0, t.id
    );
    res.json({ ok: true });
  });

  r.delete("/provider/trips/:id", requireProvider, (req, res) => {
    db.prepare("UPDATE trips SET status='deleted' WHERE id=? AND provider_id=?").run(req.params.id, req.provider!.id);
    res.json({ ok: true });
  });

  r.get("/provider/bookings", requireProvider, (req, res) => {
    const bookings = db
      .prepare(
        `SELECT b.*, t.title, u.name AS user_name, u.phone AS user_phone
         FROM bookings b JOIN trips t ON t.id=b.trip_id JOIN users u ON u.id=b.user_id
         WHERE t.provider_id=? ORDER BY b.created_at DESC LIMIT 100`
      )
      .all(req.provider!.id);
    res.json({ bookings });
  });

  r.get("/provider/reviews", requireProvider, (req, res) => {
    const reviews = db
      .prepare(
        `SELECT r.*, t.title, u.name AS user_name FROM reviews r JOIN trips t ON t.id=r.trip_id JOIN users u ON u.id=r.user_id
         WHERE t.provider_id=? ORDER BY r.created_at DESC LIMIT 100`
      )
      .all(req.provider!.id);
    res.json({ reviews });
  });

  r.post("/provider/reviews/:id/reply", requireProvider, (req, res) => {
    const rev = db
      .prepare("SELECT r.id FROM reviews r JOIN trips t ON t.id=r.trip_id WHERE r.id=? AND t.provider_id=?")
      .get(req.params.id, req.provider!.id);
    if (!rev) return res.status(404).json({ error: "التقييم غير موجود" });
    db.prepare("UPDATE reviews SET reply=? WHERE id=?").run(String(req.body?.reply || "").slice(0, 500), req.params.id);
    res.json({ ok: true });
  });

  return r;
}

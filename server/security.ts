import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

const CSRF_COOKIE = "nuzh_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// مسارات لا تحتاج توكن CSRF (تسجيل دخول جديد لا يوجد له جلسة بعد،
// لكنها محمية أصلاً بحد المحاولات + SameSite=Lax على كوكي الجلسة)
const CSRF_EXEMPT = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/provider-register", "/api/auth/login/otp"]);

function parseCookie(req: Request, name: string): string | undefined {
  const cookie = req.headers.cookie || "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1] || "") : undefined;
}

/**
 * حماية CSRF بنمط "الكوكي المزدوج" (Double Submit Cookie):
 * كوكي غير httpOnly يقرأه الفرونت إند ويرسله كـ Header — موقع خبيث ما يقدر يقرأ
 * قيمة الكوكي (سياسة نفس المصدر) فما يقدر يزوّر الطلب حتى لو استغل نموذج HTML بسيط.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  let token = parseCookie(req, CSRF_COOKIE);
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    res.cookie?.(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }
  if (SAFE_METHODS.has(req.method) || CSRF_EXEMPT.has(req.path)) return next();
  const header = req.headers["x-csrf-token"];
  if (!header || header !== token) {
    return res.status(403).json({ error: "طلب غير موثوق — أعد تحميل الصفحة وحاول مجدداً" });
  }
  next();
}

/**
 * يُلحق كوكي بدل ما يستبدل رأس Set-Cookie — لازم لأن أكثر من كوكي (الجلسة + CSRF)
 * ممكن ينضبط بنفس الاستجابة (مثلاً عند تسجيل الدخول)، واستخدام setHeader المباشر
 * يمسح أي كوكي سابق مضبوط بنفس الطلب.
 */
export function appendCookie(res: Response, raw: string) {
  const existing = res.getHeader("Set-Cookie");
  const arr = existing ? (Array.isArray(existing) ? existing : [String(existing)]) : [];
  res.setHeader("Set-Cookie", [...arr, raw]);
}

/** تحقق صارم من جسم الطلب قبل ما يوصل لأي منطق عمل — يرفض أي حقل أو نوع غير متوقع */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      return res.status(400).json({ error: first ? `${first.path.join(".")}: ${first.message}` : "بيانات غير صحيحة" });
    }
    req.body = result.data;
    next();
  };
}

// Express لا يوفر res.cookie خارج مكتبة cookie-parser — نضيفها يدوياً بدون تبعية إضافية
export function cookieHelper(_req: Request, res: Response, next: NextFunction) {
  (res as any).cookie = (name: string, value: string, opts: Record<string, any> = {}) => {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
    parts.push(`Path=${opts.path || "/"}`);
    if (opts.httpOnly) parts.push("HttpOnly");
    if (opts.secure) parts.push("Secure");
    if (opts.sameSite) parts.push(`SameSite=${opts.sameSite[0].toUpperCase()}${opts.sameSite.slice(1)}`);
    appendCookie(res, parts.join("; "));
  };
  next();
}

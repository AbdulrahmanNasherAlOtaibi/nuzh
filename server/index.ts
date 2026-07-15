import express from "express";
import path from "node:path";
import fs from "node:fs";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { seedIfEmpty } from "./seed.ts";
import { attachUser, authRouter } from "./auth.ts";
import { apiRouter } from "./api.ts";
import { adminRouter } from "./admin.ts";
import { cookieHelper, csrfProtection } from "./security.ts";

seedIfEmpty();

const isProd = process.env.NODE_ENV === "production";
const app = express();
app.set("trust proxy", 1); // خلف بروكسي (Nginx/DigitalOcean) — يلزم لمعرفة IP الحقيقي ولإعادة توجيه HTTPS

// إعادة توجيه HTTP إلى HTTPS بالإنتاج فقط (خلف بروكسي عكسي يمرر X-Forwarded-Proto)
if (isProd) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: "12mb" }));
app.use(cookieHelper);
app.use(attachUser);
app.use(csrfProtection);

// حد عام لمعدل الطلبات على كل واجهات API (حماية إضافية فوق حد تسجيل الدخول الخاص)
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "طلبات كثيرة جداً — حاول بعد قليل" },
  })
);

app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter());
app.use("/api/admin", adminRouter());
app.use("/api", apiRouter());

app.use("/api", (_req, res) => res.status(404).json({ error: "غير موجود" }));

// الواجهة المبنية (الإنتاج) — أثناء التطوير يخدمها Vite على منفذ منفصل
const publicDir = path.join(process.cwd(), "dist/public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res.type("text").send("Nuzh API تعمل ✅ — ابنِ الواجهة أولاً: npm run build ثم أعد التشغيل، أو استخدم npm run dev للتطوير.")
  );
}

const port = Number(process.env.PORT || 5001);
app.listen(port, "0.0.0.0", () => {
  console.log(`🌿 نُزه تعمل على http://localhost:${port}`);
});

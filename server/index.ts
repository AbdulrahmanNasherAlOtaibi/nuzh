import express from "express";
import path from "node:path";
import fs from "node:fs";
import { seedIfEmpty } from "./seed.ts";
import { attachUser, authRouter } from "./auth.ts";
import { apiRouter } from "./api.ts";
import { adminRouter } from "./admin.ts";

seedIfEmpty();

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(attachUser);

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

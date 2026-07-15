// إعداد PM2 — يعيد تشغيل السيرفر تلقائياً عند أي انهيار، ويحدد سقف ذاكرة آمن.
// تشغيل: pm2 start ecosystem.config.cjs --env production
module.exports = {
  apps: [
    {
      name: "nuzh",
      script: "server/index.ts",
      interpreter: "npx",
      interpreter_args: "tsx",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production" },
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      time: true,
    },
  ],
};

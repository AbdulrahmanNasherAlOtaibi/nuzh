import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/public",
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:5001",
      "/uploads": "http://localhost:5001",
    },
  },
});

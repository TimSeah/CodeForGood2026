import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // All API calls go to /api/... and are forwarded to the Next.js backend, so no CORS setup is needed.
    // API_PROXY_TARGET lets a second checkout / verification run point at a backend on another port.
    proxy: { "/api": process.env.API_PROXY_TARGET ?? "http://localhost:3001" },
  },
});

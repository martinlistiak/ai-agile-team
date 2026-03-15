/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: apiProxyTarget,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});

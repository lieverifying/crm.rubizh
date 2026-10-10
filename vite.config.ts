import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/crm/",
  server: {
    proxy: {
      "/api/staff": { target: "http://127.0.0.1:8082", changeOrigin: false },
    },
  },
  build: { target: "es2022", sourcemap: false },
});

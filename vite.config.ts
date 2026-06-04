import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/space": {
        target: process.env.VITE_SPACE_PROXY || "http://127.0.0.1:7860",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/space/, "")
      }
    }
  }
});


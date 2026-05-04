import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "node:child_process";

function readAppVersion(): string {
  try {
    return execSync("git describe --tags --exact-match HEAD 2>/dev/null", { cwd: path.resolve(__dirname, "..", "..") })
      .toString()
      .trim();
  } catch {
    try {
      return execSync("git describe --tags --abbrev=0 2>/dev/null", { cwd: path.resolve(__dirname, "..", "..") })
        .toString()
        .trim();
    } catch {
      return process.env.npm_package_version ?? "0.0.1";
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion())
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:2567",
        ws: true
      }
    }
  }
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const SERVER_PORT = process.env.SERVER_PORT ?? "3001";

export default defineConfig({
  root: "src/client",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${SERVER_PORT}`,
    },
  },
  define: {
    __SERVER_PORT__: JSON.stringify(SERVER_PORT),
  },
});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the Vite server forwards /api/<service> to the service running on your machine.
const host = process.env.API_HOST || "localhost";
const services = {
  auth: 8081,
  catalog: 8082,
  inventory: 8083,
  orders: 8084,
  payments: 8085,
  notifications: 8086,
  analytics: 8087,
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      Object.entries(services).map(([name, port]) => [`/api/${name}`, `http://${host}:${port}`])
    ),
  },
});

import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@monaco-editor") || id.includes("monaco-editor")) {
            return "vendor-monaco";
          }
          if (id.includes("plotly.js") || id.includes("react-plotly.js")) {
            return "vendor-plotly";
          }
          if (id.includes("@xyflow/react") || id.includes("@dnd-kit")) {
            return "vendor-builder";
          }
          if (id.includes("node_modules")) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
  // TODO - figure out a better way to do this if there is
  // Ensure Vite uses the port provided by Aspire AppHost so it lines up in the dashboard
  server: {
    port: Number(process.env.VITE_PORT) || Number(process.env.PORT) || 5173,
    strictPort: true, // So vite exits if exact port specified is busy
    host: true, // binds Vite to all interfaces (0.0.0.0) instead of just localhost
  },
});

import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";

const STATIC_ASSET_RELEASE_SUFFIX = "vdab-static-v1";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-${STATIC_ASSET_RELEASE_SUFFIX}.js`,
        chunkFileNames: `assets/[name]-[hash]-${STATIC_ASSET_RELEASE_SUFFIX}.js`,
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
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true, // So vite exits if exact port specified is busy
    host: true, // binds Vite to all interfaces (0.0.0.0) instead of just localhost
  },
});

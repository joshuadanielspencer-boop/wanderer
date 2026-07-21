import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base-path aware from day one, the same way Shutterbug is: served from a domain
// root by default, or under /<repo>/ for a GitHub Pages project site.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
});

import { defineConfig } from "vite";

export default defineConfig({
    // Relative base so the build works under https://fs-frost.github.io/snake/
    base: "./",
    server: { port: 5000 },
    build: {
        outDir: "dist",
        target: "es2022",
        chunkSizeWarningLimit: 2000,
    },
});

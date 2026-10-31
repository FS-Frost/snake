import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    // Relative base so the build works under https://fs-frost.github.io/snake/
    base: "./",
    server: { port: 5000 },
    build: {
        outDir: "dist",
        target: "es2022",
        chunkSizeWarningLimit: 2000,
    },
    plugins: [
        VitePWA({
            // New versions install silently and apply on the next launch: no "update available" popups.
            registerType: "autoUpdate",
            injectRegister: "script",
            includeAssets: ["favicon.png"],
            manifest: {
                name: "Snake: Neon Grid",
                short_name: "Snake",
                description: "Neon synthwave Snake with power-ups.",
                start_url: ".",
                scope: ".",
                display: "fullscreen",
                orientation: "portrait",
                background_color: "#05040f",
                theme_color: "#05040f",
                icons: [
                    { src: "favicon.png", sizes: "512x512", type: "image/png", purpose: "any" },
                ],
            },
            workbox: {
                // Phaser alone is ~1.4 MB; precache everything so the game runs fully offline.
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                globPatterns: ["**/*.{js,css,html,png,woff,woff2}"],
                cleanupOutdatedCaches: true,
            },
        }),
    ],
});

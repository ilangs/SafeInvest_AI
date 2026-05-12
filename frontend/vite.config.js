import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA 설정은 프론트 화면 기능을 건드리지 않고,
// 브라우저에서 앱 설치가 가능하도록 해주는 설정입니다.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // public 폴더에 있는 아이콘을 앱 아이콘으로 사용합니다.
      manifest: {
        name: "Ju-Dy",
        short_name: "Ju-Dy",
        description: "AI 기반 주식 교육 및 모의투자 서비스",
        theme_color: "#fce9e9",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },

      // 개발 중에도 PWA 동작을 확인할 수 있게 합니다.
      devOptions: {
        enabled: true,
      },
    }),
  ],

  server: {
    proxy: {
      "/api": "http://172.30.1.81:8000",
    },
  },
});

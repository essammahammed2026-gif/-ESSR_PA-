import type { MetadataRoute } from "next";

// Web app manifest — drives the installed-app / OS taskbar icon in Chromium & Zen.
// Icons are generated from the concept-3 master mark (see SESSION_LOG.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flint Prepress Studio",
    short_name: "Flint",
    description: "Commercial print imposition & prepress studio",
    start_url: "/",
    display: "standalone",
    background_color: "#12151B",
    theme_color: "#181D27",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

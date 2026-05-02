import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dairy Professionals",
    short_name: "DairyPro",
    description: "Sistema de gestión de granjas lecheras",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111827",
    theme_color: "#111827",
    lang: "es",
    icons: [
      { src: "/logo.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
      { src: "/logo.png", sizes: "any",     type: "image/png", purpose: "maskable any" },
    ],
    categories: ["business", "productivity"],
  };
}

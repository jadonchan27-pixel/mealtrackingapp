import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Lets the app be installed to a phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meal Tracking App",
    short_name: "Meal Tracker",
    description: "Calorie tracking and weekly meal planning",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2f7d4f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delivery Manager",
    short_name: "Delivery",
    description: "Панель управления доставками",
    id: "/office/login",
    start_url: "/office/login",
    scope: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ru",
    icons: [
      {
        src: "/brand/brotli-mark.png",
        sizes: "134x134",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}

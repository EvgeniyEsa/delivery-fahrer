import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Водитель Brötli",
    short_name: "Водитель",
    description: "Доставки на сегодня",
    start_url: "/driver",
    scope: "/",
    display: "standalone",
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

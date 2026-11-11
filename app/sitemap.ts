import type { MetadataRoute } from "next";
import { site } from "@/content/site";
import { games } from "@/lib/games/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.arcadeUrl}/play`, priority: 1 },
    { url: `${site.arcadeUrl}/privacy`, priority: 0.2 },
    ...games.map(g => ({ url: `${site.arcadeUrl}/play/${g.slug}`, priority: 0.7 })),
  ];
}

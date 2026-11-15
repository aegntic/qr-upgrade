import type { MetadataRoute } from "next";
import { site } from "@/lib/facts";
import { guideSitemapPaths } from "@/lib/guides";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/generator",
    "/scan-lab",
    "/templates",
    "/docs",
    "/privacy",
    "/press",
    "/ai",
    "/blog",
    "/pricing",
    "/dynamic",
    "/brand-kits",
    ...guideSitemapPaths,
  ].map((path) => ({ url: site + path }));
}

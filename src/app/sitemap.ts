import type { MetadataRoute } from "next";
import { site } from "@/lib/facts";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/generator",
    "/scan-lab",
    "/templates",
    "/docs",
    "/ai",
    "/blog",
    "/pricing",
    "/dynamic",
    "/brand-kits",
  ].map((path) => ({ url: site + path }));
}

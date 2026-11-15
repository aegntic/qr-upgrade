import type { Metadata } from "next";
import { site } from "@/lib/facts";

export const guidePublished = "2026-11-15";

const publisher = {
  "@type": "Organization",
  name: "QR Upgrade",
  url: site,
} as const;

export const guideIndex = {
  path: "/guides",
  title: "Guides: plans, dynamic QR and print checks | QR Upgrade",
  description:
    "Three QR Upgrade guides on what Free, Pro and Brand change, when a dynamic QR needs a paid plan, and why a digital decode is not a print guarantee.",
  h1: "QR Upgrade guides",
} as const;

export const guides = {
  compare: {
    slug: "free-studio-versus-pro-and-brand",
    title: "Free studio versus Pro and Brand | QR Upgrade",
    description:
      "The free QR Upgrade studio creates, checks and exports artwork. Pro and Brand raise four account limits. Current prices stay on the pricing page.",
    h1: "Free studio versus Pro and Brand: what you actually pay for",
    kicker: "GUIDES / PLANS",
  },
  dynamic: {
    slug: "when-a-dynamic-qr-is-worth-a-paid-plan",
    title: "When a dynamic QR needs a paid plan | QR Upgrade",
    description:
      "A dynamic QR keeps one printed code and lets the destination change. Free already includes links. Compare Pro and Brand limits on the pricing page.",
    h1: "When a dynamic QR is worth a paid plan",
    kicker: "GUIDES / DYNAMIC LINKS",
  },
  print: {
    slug: "check-the-qr-before-you-print",
    title: "Check the QR before you print | QR Upgrade",
    description:
      "Check a QR in the free studio before you print. A digital decode is not a guarantee for every print. Paid plans add capacity, not a different check.",
    h1: "Check the QR before you print",
    kicker: "GUIDES / PRINT CHECKS",
  },
} as const;

export type GuideId = keyof typeof guides;

export function guidePath(id: GuideId) {
  return `/guides/${guides[id].slug}`;
}

export function guideUrl(id: GuideId) {
  return `${site}${guidePath(id)}`;
}

export const guideSitemapPaths = [
  guideIndex.path,
  guidePath("compare"),
  guidePath("dynamic"),
  guidePath("print"),
];

const image = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
};

function social(title: string, description: string, url: string, type: "article" | "website"): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      siteName: "QR Upgrade",
      title,
      description,
      url,
      ...(type === "article"
        ? { publishedTime: guidePublished, modifiedTime: guidePublished }
        : {}),
      images: [{ ...image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image.jpg"],
    },
  };
}

export function guideMetadata(id: GuideId): Metadata {
  const guide = guides[id];
  return social(guide.title, guide.description, guideUrl(id), "article");
}

export function guideIndexMetadata(): Metadata {
  return social(
    guideIndex.title,
    guideIndex.description,
    `${site}${guideIndex.path}`,
    "website",
  );
}

export function articleStructuredData(id: GuideId) {
  const guide = guides[id];
  const url = guideUrl(id);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.h1,
        description: guide.description,
        inLanguage: "en",
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        url,
        datePublished: guidePublished,
        dateModified: guidePublished,
        publisher,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site },
          {
            "@type": "ListItem",
            position: 2,
            name: "Guides",
            item: `${site}${guideIndex.path}`,
          },
          { "@type": "ListItem", position: 3, name: guide.h1, item: url },
        ],
      },
    ],
  };
}

export function guideIndexStructuredData() {
  const url = `${site}${guideIndex.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: guideIndex.h1,
        description: guideIndex.description,
        url,
        inLanguage: "en",
        isPartOf: { "@type": "WebSite", name: "QR Upgrade", url: site },
        publisher,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: site },
          { "@type": "ListItem", position: 2, name: "Guides", item: url },
        ],
      },
    ],
  };
}

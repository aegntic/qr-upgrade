import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import { FreeStudioArticle } from "../src/components/guides/free-studio-article";
import { DynamicQrArticle } from "../src/components/guides/dynamic-qr-article";
import { PrintCheckArticle } from "../src/components/guides/print-check-article";
import {
  articleStructuredData,
  guideIndex,
  guideIndexStructuredData,
  guides,
  guideSitemapPaths,
} from "../src/lib/guides";
import { PLAN_LIMITS } from "../shared/plan-limits.mjs";

const banned =
  /\b(delve|tapestry|unlock|elevate|empower|cutting-edge|game-changer|seamless|leverage|robust|revolutionize|harness|supercharge|landscape|realm)\b|in today's/i;

function words(html: string) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&apos;|&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
  return text.trim().split(/\s+/).filter(Boolean);
}

function render(node: ReactElement) {
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, {
      value: {} as never,
      children: node,
    }),
  );
}

test("guide titles, descriptions and structured data stay specific and unsourced-author free", () => {
  for (const guide of Object.values(guides)) {
    assert.ok(guide.title.length < 60, guide.title);
    assert.ok(guide.description.length >= 140 && guide.description.length <= 160, `${guide.description.length} ${guide.description}`);
    assert.equal((guide.title.match(/\|/g) || []).length, 1);
  }
  assert.ok(guideIndex.title.length < 60);
  assert.ok(guideIndex.description.length >= 140 && guideIndex.description.length <= 160);
  for (const id of ["compare", "dynamic", "print"] as const) {
    const data = articleStructuredData(id);
    const [article, crumbs] = data["@graph"];
    assert.ok(article && crumbs);
    assert.equal(article["@type"], "Article");
    assert.equal(crumbs["@type"], "BreadcrumbList");
    const publisher = article.publisher;
    const items = crumbs.itemListElement;
    assert.ok(publisher);
    assert.ok(items);
    assert.equal(publisher["@type"], "Organization");
    assert.equal("author" in article, false);
    assert.equal(article.headline, guides[id].h1);
    assert.equal(items.length, 3);
    assert.equal(items[0]?.item, "https://qrupgrade.com");
  }
  const index = guideIndexStructuredData();
  const [collection, indexCrumbs] = index["@graph"];
  assert.ok(collection && indexCrumbs);
  assert.equal(collection["@type"], "CollectionPage");
  assert.equal(indexCrumbs["@type"], "BreadcrumbList");
  assert.equal("author" in collection, false);
});

test("sitemap lists pricing and the guides, and robots still allows them", () => {
  const urls = sitemap().map((item) => item.url);
  for (const path of ["/pricing", ...guideSitemapPaths]) {
    assert.ok(urls.includes("https://qrupgrade.com" + path), path);
  }
  assert.equal(new Set(urls).size, urls.length);
  const rules = robots();
  assert.equal(rules.sitemap, "https://qrupgrade.com/sitemap.xml");
  assert.deepEqual(rules.rules, { userAgent: "*", allow: "/", disallow: "/api/" });
});

test("each guide is long enough, cross-linked, and free of invented prices", () => {
  const pages = [
    { name: "compare", html: render(createElement(FreeStudioArticle)), limits: true },
    { name: "dynamic", html: render(createElement(DynamicQrArticle)), limits: true },
    { name: "print", html: render(createElement(PrintCheckArticle)), limits: true },
  ];
  for (const page of pages) {
    const count = words(page.html).length;
    assert.ok(count >= 700 && count <= 1100, `${page.name} ${count}`);
    assert.equal((page.html.match(/<h1/g) || []).length, 1, page.name);
    assert.ok(page.html.includes('href="/pricing"'), page.name);
    assert.doesNotMatch(page.html, banned, page.name);
    assert.doesNotMatch(page.html, /[—–]/, page.name);
    assert.doesNotMatch(page.html, /\$12|\$25|US\$12|12\.00|25\.00/, page.name);
    assert.ok(page.html.includes(String(PLAN_LIMITS.free.dynamicLinks)), page.name);
    assert.ok(page.html.includes("not a guarantee for every print"), page.name);
  }
  const compare = pages[0].html;
  const dynamic = pages[1].html;
  const print = pages[2].html;
  assert.match(compare, /href="\/guides\/when-a-dynamic-qr-is-worth-a-paid-plan"/);
  assert.match(compare, /href="\/guides\/check-the-qr-before-you-print"/);
  assert.match(dynamic, /href="\/links"/);
  assert.match(dynamic, /href="\/guides\/free-studio-versus-pro-and-brand"/);
  assert.match(dynamic, /href="\/guides\/check-the-qr-before-you-print"/);
  assert.match(print, /href="\/docs"/);
  assert.match(print, /href="\/guides\/free-studio-versus-pro-and-brand"/);
  assert.match(print, /href="\/guides\/when-a-dynamic-qr-is-worth-a-paid-plan"/);
  assert.match(readFileSync("src/components/brand.tsx", "utf8"), /href="\/guides"/);
  assert.match(readFileSync("src/app/docs/page.tsx", "utf8"), /href="\/guides\/check-the-qr-before-you-print"/);
  assert.doesNotMatch(readFileSync("src/app/robots.ts", "utf8"), /guides/);
});

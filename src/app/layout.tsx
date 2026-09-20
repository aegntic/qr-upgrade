import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { Header, Footer } from "@/components/brand";
import { site, description } from "@/lib/facts";
import "./globals.css";
import "./metal.css";
import "./showcase.css";
import "./art-studio.css";
import "./generator.css";
import "./obsidian.css";
import { WorkflowProvider } from "@/components/workflow-provider";
import "./workflow.css";
import { MotionSystem } from "@/components/motion-system";
const font = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm",
});
const displayFont = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "QR Upgrade — Your brand. Every scan.",
    template: "%s | QR Upgrade",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "QR Upgrade",
    title: "QR Upgrade — Your brand. Every scan.",
    description,
    url: site,
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "QR Upgrade — Your brand. Every scan.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QR Upgrade — Your brand. Every scan.",
    description,
    images: ["/opengraph-image.jpg"],
  },
  icons: {
    icon: [
      {
        url: "/brand/qr-upgrade-logo-v3-32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/brand/qr-upgrade-logo-v3-64.png",
        type: "image/png",
        sizes: "64x64",
      },
    ],
    apple: {
      url: "/brand/qr-upgrade-apple-v3.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${font.variable} ${displayFont.variable} obsidian`}>
        <MotionSystem>
        <WorkflowProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header />
          {children}
          <Footer />
        </WorkflowProvider>
        </MotionSystem>
      </body>
    </html>
  );
}

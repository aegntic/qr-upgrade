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
  },
  twitter: {
    card: "summary_large_image",
    title: "QR Upgrade — Your brand. Every scan.",
    description,
  },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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

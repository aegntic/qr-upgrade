import Link from "next/link";
import { MotionToggle } from "./motion-system";
import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="QR Upgrade home">
      <span className="brand-mark">
        <i />
        <i />
        <i />
        <b>↗</b>
      </span>
      <span>
        QR <span className="brand-light">upgrade</span>
      </span>
    </Link>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/generator">QR Generator</Link>
        <Link href="/scan-lab">Scan Lab</Link>
        <Link href="/#features">Features</Link>
        <Link href="/#examples">Examples</Link>
        <Link href="/#qr-types">QR types</Link>
      </nav>
      <div className="header-actions">
        <MotionToggle />
        <Link href="/generator" className="nav-cta">
          Open studio <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer foundation-footer">
      <div>
        <Brand />
        <p>A little square. A better connection.</p>
        <span>© {new Date().getFullYear()} QR Upgrade</span>
      </div>
      <nav aria-label="Create">
        <strong>Create</strong>
        <Link href="/generator?mode=custom">Custom QR</Link>
        <Link href="/generator?mode=image">Image QR</Link>
        <Link href="/generator?mode=art">QR Art</Link>
        <Link href="/scan-lab">Scan Lab</Link>
        <Link href="/#qr-types">QR types</Link>
      </nav>
      <nav aria-label="Explore">
        <strong>Explore</strong>
        <Link href="/templates">Examples</Link>
        <Link href="/brand-studies">Brand studies</Link>
        <Link href="/#features">Features</Link>
        <Link href="/#faq">FAQ</Link>
      </nav>
      <nav aria-label="Resources">
        <strong>Resources</strong>
        <Link href="/docs">Methodology</Link>
        <Link href="/ai">Product facts</Link>
        <Link href="/dynamic">Dynamic links roadmap</Link>
        <a href="/llms.txt">llms.txt</a>
      </nav>
    </footer>
  );
}

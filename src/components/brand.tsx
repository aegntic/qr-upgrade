import Link from "next/link";
import { MobileNavigation } from "./mobile-navigation";
import { MotionToggle } from "./motion-system";
import { ArrowUpRight } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="QR Upgrade home">
      <img
        className="brand-mark"
        src="/brand/qr-upgrade-logo-v2.png"
        alt=""
        width={42}
        height={42}
      />
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
        <Link href="/designs">My designs</Link>
        <Link href="/#examples">Examples</Link>
        <Link href="/#qr-types">QR types</Link>
      </nav>
      <div className="header-actions">
        <MotionToggle />
        <MobileNavigation />
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
        <Link href="/designs">My designs</Link>
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
        <Link href="/account">Your account</Link>
        <Link href="/docs">Methodology</Link>
        <Link href="/ai">Product facts</Link>
        <Link href="/links">Dynamic links</Link>
        <Link href="/content">Hosted content</Link>
        <Link href="/billing">Billing</Link>
        <a href="/llms.txt">llms.txt</a>
      </nav>
    </footer>
  );
}

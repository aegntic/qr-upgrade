'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
export function MobileNavigation() {
  const ref = useRef<HTMLDetailsElement>(null), pathname = usePathname();
  useEffect(()=>{if(ref.current)ref.current.open=false;},[pathname]);
  return <details className="mobile-navigation" ref={ref} onKeyDown={e=>{if(e.key==='Escape'&&ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus();}}}><summary aria-label="Open navigation"><Menu size={20}/></summary><nav aria-label="Mobile navigation" onClick={()=>{if(ref.current)ref.current.open=false;}}><Link href="/generator">QR Studio</Link><Link href="/designs">My designs</Link><Link href="/scan-lab">Scan Lab</Link><Link href="/templates">Artwork library</Link><Link href="/brand-studies">Brand studies</Link><Link href="/docs">How it works</Link><Link href="/account">Your account</Link></nav></details>;
}

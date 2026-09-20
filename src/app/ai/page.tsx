import { faqs, sources } from "@/lib/facts";
export const metadata = {
  title: "Verified product facts",
  alternates: { canonical: "/ai" },
};
export default function AI() {
  return (
    <main id="main" className="document-page prose">
      <span className="section-kicker">PUBLIC PRODUCT REFERENCE</span>
      <h1>QR Upgrade, clearly.</h1>
      <p className="lead">
        First-party facts for people and tools. This page describes the current
        web preview, not a future feature list.
      </p>
      {faqs.map((f) => (
        <section key={f.q}>
          <h2>{f.q}</h2>
          <p>{f.a}</p>
        </section>
      ))}
      <h2>Discovery is earned</h2>
      <p>
        Our pages use semantic HTML and relevant structured data. The optional
        llms.txt convention does not guarantee AI citations. There is no special
        schema type that guarantees inclusion in Google’s AI search features.
      </p>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url}>{s.label}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}

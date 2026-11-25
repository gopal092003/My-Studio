import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { realms } from "@/features/landing/data/realms";

export default function HomePage() {
  return (
    <div className="page-shell">
      <SiteHeader />

      <main className="home-main">
        <section className="hero" aria-labelledby="home-title">
          <p className="eyebrow">One account. Multiple creative worlds.</p>
          <h1 id="home-title">
            Stories
            <br />
            in the making.
          </h1>
          <div className="rule" aria-hidden="true" />
        </section>

        <nav className="world-links" aria-label="Explore the studio">
          {realms.map((realm, index) => (
            <Link className="world-link" href={`/${realm.slug}`} key={realm.slug}>
              <span className="world-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{realm.title}</span>
              <span className="arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          ))}
        </nav>
      </main>

      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import { NotificationLink } from "@/components/notification-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        STUDIO UNIVERSE
      </Link>
      <nav className="account-nav" aria-label="Account">
        <Link href="/login">Log in</Link>
        <Link className="signup-link" href="/signup">Create account</Link>
        <NotificationLink />
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}

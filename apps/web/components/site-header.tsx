import Link from "next/link";
import { NotificationLink } from "@/components/notification-link";
import { StudioThemeToggle } from "@/components/studio-theme-toggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        STUDIO UNIVERSE
      </Link>
      <nav className="account-nav" aria-label="Account">
        <StudioThemeToggle />
        <Link href="/login">Log in</Link>
        <Link className="signup-link" href="/signup">Create account</Link>
        <NotificationLink />
        <Link href="/admin">Admin</Link>
      </nav>
    </header>
  );
}

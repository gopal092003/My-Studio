import { AuthForm } from "@/components/auth-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function LoginPage() {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="auth-main"><AuthForm mode="login" /></main>
      <SiteFooter />
    </div>
  );
}

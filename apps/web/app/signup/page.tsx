import { AuthForm } from "@/components/auth-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SignupPage() {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="auth-main"><AuthForm mode="signup" /></main>
      <SiteFooter />
    </div>
  );
}

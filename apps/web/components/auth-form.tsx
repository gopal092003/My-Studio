"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("display_name") ?? "").trim();
    const searchParams = new URLSearchParams(window.location.search);
    const requestedPath = searchParams.get("next") ?? "/";
    const nextPath = requestedPath.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/";

    try {
      const supabase = createSupabaseBrowserClient("primary");
      const result = isSignup
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: displayName },
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setErrorMessage(result.error.message);
      } else if (isSignup && !result.data.session) {
        setMessage("Check your email to confirm your account, then log in.");
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to connect to Supabase.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <p className="eyebrow">Studio Universe account</p>
      <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="auth-description">
        {isSignup ? "Sign up to follow the worlds as they grow." : "Log in to your Studio Universe account."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignup && (
          <label>
            Display name
            <input autoComplete="name" name="display_name" type="text" />
          </label>
        )}
        <label>
          Email
          <input autoComplete="email" name="email" required type="email" />
        </label>
        <label>
          Password
          <input
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            name="password"
            required
            type="password"
          />
        </label>
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      {message && <p className="form-message" role="status">{message}</p>}
      {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

      <p className="auth-switch">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link>
      </p>
    </section>
  );
}

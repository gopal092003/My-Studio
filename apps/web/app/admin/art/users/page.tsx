import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Database } from "@/types/database";
import { setUserRestrictionAction } from "../actions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const dynamic = "force-dynamic";

export default async function ManageUsersPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "user")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load users: ${error.message}`);
  const users: Profile[] = data ?? [];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Art community</p>
            <h1>Manage users</h1>
            <p>Restrictions prevent likes, comments, and Art chat messages. Users can still view the site.</p>
          </div>
          <Link className="button-secondary" href="/admin/art">Back to artwork desk</Link>
        </div>

        {users.length === 0 ? (
          <p className="empty-state">No user accounts yet.</p>
        ) : (
          <div className="restricted-user-list">
            {users.map((user) => (
              <article className="restricted-user-card" key={user.id}>
                <div>
                  <h2>{user.display_name || "Studio User"}</h2>
                  <p>{user.email || "Email unavailable"}</p>
                  <span className={user.is_restricted ? "restriction-status is-restricted" : "restriction-status"}>
                    {user.is_restricted ? "Restricted" : "Active"}
                  </span>
                  {user.is_restricted && user.restriction_reason && <p className="restriction-reason">Reason: {user.restriction_reason}</p>}
                </div>
                <form action={setUserRestrictionAction} className="restriction-form">
                  <input name="user_id" type="hidden" value={user.id} />
                  <input name="restricted" type="hidden" value={String(!user.is_restricted)} />
                  {!user.is_restricted && (
                    <label>
                      Restriction reason (optional)
                      <input maxLength={500} name="reason" placeholder="Add a short reason" />
                    </label>
                  )}
                  <button className={user.is_restricted ? "button-secondary" : "button-danger"} type="submit">
                    {user.is_restricted ? "Lift restriction" : "Restrict user"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

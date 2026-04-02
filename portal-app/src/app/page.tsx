import { getCurrentUser } from "@/lib/auth";
import { getAllProjects } from "@/lib/project-settings";
import { HypersetLayout } from "@/components/HypersetLayout";

export default async function Home() {
  const user = await getCurrentUser();

  const domain = (process.env.HYPERSET_DOMAIN || "").trim() || "hyperset.internal";
  const explicitPagesUrl = (process.env.PAGES_PUBLIC_URL || "").trim();
  const pagesUrl = explicitPagesUrl || `https://pages.${domain}`;

  // Users who are only in readOnlyEmails cannot access the admin panel.
  // Admins, project creators, and users in allowedEmails can.
  let canAccessAdmin = user.isAdmin;
  if (!canAccessAdmin && user.email) {
    try {
      const projects = await getAllProjects();
      canAccessAdmin = projects.some(
        (p) => p.createdBy === user.email || p.allowedEmails.includes(user.email),
      );
    } catch {
      // DB unavailable at build/boot time — fail open so the admin panel stays accessible
      canAccessAdmin = true;
    }
  }

  return (
    <HypersetLayout
      pagesUrl={pagesUrl}
      isAdmin={user.isAdmin}
      userEmail={user.email}
      canAccessAdmin={canAccessAdmin}
    />
  );
}

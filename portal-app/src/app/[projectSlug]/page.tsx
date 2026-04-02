import { getCurrentUser } from "@/lib/auth";
import { getAllProjects } from "@/lib/project-settings";
import { canUserViewProject } from "@/lib/project-settings";
import { HypersetLayout } from "@/components/HypersetLayout";

interface Props {
  params: Promise<{ projectSlug: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { projectSlug } = await params;
  const user = await getCurrentUser();

  const domain = (process.env.HYPERSET_DOMAIN || "").trim() || "hyperset.internal";
  const explicitPagesUrl = (process.env.PAGES_PUBLIC_URL || "").trim();
  const pagesUrl = explicitPagesUrl || `https://pages.${domain}`;

  let initialProjectId: string | undefined;
  let canAccessAdmin = user.isAdmin;

  try {
    const projects = await getAllProjects();
    const decodedSlug = decodeURIComponent(projectSlug).toLowerCase();
    const match = projects.find(
      (p) => canUserViewProject(p, user.email, user.isAdmin) && p.name.toLowerCase() === decodedSlug,
    );
    if (match) initialProjectId = match.id;

    if (!canAccessAdmin && user.email) {
      canAccessAdmin = projects.some(
        (p) => p.createdBy === user.email || p.allowedEmails.includes(user.email),
      );
    }
  } catch {
    canAccessAdmin = true;
  }

  return (
    <HypersetLayout
      pagesUrl={pagesUrl}
      isAdmin={user.isAdmin}
      userEmail={user.email}
      canAccessAdmin={canAccessAdmin}
      initialProjectId={initialProjectId}
    />
  );
}

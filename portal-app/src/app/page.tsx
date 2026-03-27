import { getCurrentUser } from "@/lib/auth";
import { HypersetLayout } from "@/components/HypersetLayout";

export default async function Home() {
  const user = await getCurrentUser();

  const domain = (process.env.HYPERSET_DOMAIN || "").trim() || "hyperset.internal";
  const explicitPagesUrl = (process.env.PAGES_PUBLIC_URL || "").trim();
  const pagesUrl = explicitPagesUrl || `https://pages.${domain}`;

  return (
    <HypersetLayout
      pagesUrl={pagesUrl}
      isAdmin={user.isAdmin}
      userEmail={user.email}
    />
  );
}

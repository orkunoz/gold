import { requireUser } from "@/lib/auth/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  await requireUser();
  return <PlaceholderPage title="Dashboard" description="Your business overview will appear here as your workspace grows." />;
}

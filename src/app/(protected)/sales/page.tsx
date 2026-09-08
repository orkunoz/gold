import { requireUser } from "@/lib/auth/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Sales" };
export default async function SalesPage() {
  await requireUser();
  return <PlaceholderPage title="Sales" description="Your sales workspace will be available here in a future update." />;
}

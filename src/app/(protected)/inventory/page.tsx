import { requireUser } from "@/lib/auth/session";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Inventory" };
export default async function InventoryPage() {
  await requireUser();
  return <PlaceholderPage title="Inventory" description="Your jewelry inventory will be available here in a future update." />;
}

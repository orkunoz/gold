import Link from "next/link";
import { getAdminEmployees } from "@/lib/admin/queries";
import { deleteEmployeeAccount } from "@/lib/admin/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getTranslations } from "@/lib/i18n/server";

export const metadata = { title: "Account administration" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const {t}=await getTranslations();
  const [employees, params] = await Promise.all([getAdminEmployees(), searchParams]);
  return <section><Link href="/admin" className="text-sm text-stone-600">← {t("admin.title")}</Link><div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between"><h1 className="text-3xl font-semibold">{t("admin.accounts")}</h1><Link href="/admin/employees/invite" className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">{t("admin.createAccount")}</Link></div>{params.error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{params.error}</p> : null}<div className="mt-6 overflow-x-auto rounded-xl border bg-white" aria-label={t("admin.accounts")}>{employees.length ? <table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b bg-stone-50 text-xs uppercase text-stone-500"><tr>{[t("auth.username"),t("admin.role"),t("fields.shop"),t("fields.status"),t("common.actions")].map(heading => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">{employees.map(employee => <tr key={employee.id}><td className="px-4 py-3 font-medium">{employee.username || employee.full_name || t("admin.legacyAccount")}</td><td className="px-4 py-3">{t(`admin.${employee.role}`)}</td><td className="px-4 py-3">{employee.shops?.name || t("common.unassigned")}</td><td className="px-4 py-3">{employee.is_active ? t("common.active") : t("common.inactive")}</td><td className="px-4 py-3"><div className="flex gap-3"><Link href={`/admin/employees/${employee.id}/edit`} className="font-medium text-amber-900 hover:underline">{t("common.edit")}</Link><ConfirmActionButton action={deleteEmployeeAccount.bind(null,employee.id)} label={t("common.delete")} title={t("admin.deleteAccountTitle")} name={employee.username || employee.full_name || t("admin.accounts")} message={t("admin.cannotUndo")} danger /></div></td></tr>)}</tbody></table> : <p className="p-10 text-center text-sm text-stone-500">{t("admin.noAccounts")}</p>}</div></section>;
}

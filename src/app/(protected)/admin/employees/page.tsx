import Link from "next/link";
import { getAdminEmployees } from "@/lib/admin/queries";
import { deleteEmployeeAccount } from "@/lib/admin/actions";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { getTranslations } from "@/lib/i18n/server";
import { PageHeading } from "@/components/ui/page-heading";
import { buttonStyles } from "@/components/ui/button";

export const metadata = { title: "Account administration" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const {t}=await getTranslations();
  const [employees, params] = await Promise.all([getAdminEmployees(), searchParams]);
  return <section><Link href="/admin" className="text-sm text-stone-600">← {t("admin.title")}</Link><div className="mt-5"><PageHeading title={t("admin.accounts")} actions={<Link href="/admin/employees/invite" className={buttonStyles("primary")}>{t("admin.createAccount")}</Link>} /></div>{params.error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{params.error}</p> : null}<div className="zl-table-wrap mt-6" aria-label={t("admin.accounts")}>{employees.length ? <table className="zl-table min-w-[720px]"><thead><tr>{[t("auth.username"),t("admin.role"),t("fields.shop"),t("fields.status"),t("common.actions")].map(heading => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{employees.map(employee => <tr key={employee.id}><td className="font-medium">{employee.username || employee.full_name || t("admin.legacyAccount")}</td><td>{t(`admin.${employee.role}`)}</td><td>{employee.shops?.name || t("common.unassigned")}</td><td>{employee.is_active ? t("common.active") : t("common.inactive")}</td><td><div className="flex gap-3"><Link href={`/admin/employees/${employee.id}/edit`} className="font-medium text-amber-900 hover:underline">{t("common.edit")}</Link><ConfirmActionButton action={deleteEmployeeAccount.bind(null,employee.id)} label={t("common.delete")} title={t("admin.deleteAccountTitle")} name={employee.username || employee.full_name || t("admin.accounts")} message={t("admin.cannotUndo")} danger /></div></td></tr>)}</tbody></table> : <p className="p-10 text-center text-sm text-stone-500">{t("admin.noAccounts")}</p>}</div></section>;
}

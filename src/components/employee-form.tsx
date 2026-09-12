"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { EmployeeRole } from "@/lib/database.types";
import type { AdminState } from "@/lib/admin/actions";
import { ADMIN_ROLES } from "@/lib/admin/validation";
import { useI18n } from "./i18n-provider";

type Action=(state:AdminState,form:FormData)=>Promise<AdminState>; type Shop={id:string;name:string};
type Employee={full_name:string|null;email:string|null;username?:string|null;role:EmployeeRole;shop_id:string|null;is_active:boolean};
export function EmployeeForm({action,shops,employee,invite=false}:{action:Action;shops:Shop[];employee?:Employee;invite?:boolean}) {
  const {t}=useI18n();
  const [state,formAction,pending]=useActionState(action,{error:""});
  function confirmSensitive(event: React.FormEvent<HTMLFormElement>) {
    if(!employee)return; const data=new FormData(event.currentTarget);
    const deactivating=employee.is_active&&!data.has("is_active");
    const downgradingOwner=employee.role==="owner"&&data.get("role")!=="owner";
    if((deactivating||downgradingOwner)&&!window.confirm("Confirm this sensitive account change."))event.preventDefault();
  }
  return <form action={formAction} onSubmit={confirmSensitive} className="max-w-2xl space-y-5">
    {state.error?<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{state.error}</p>:null}{state.success?<p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{state.success}</p>:null}
    {invite?<><label className="block text-sm font-medium">{t("auth.username")}<input name="username" required minLength={3} maxLength={32} pattern="[a-z0-9][a-z0-9_-]{2,31}" autoCapitalize="none" spellCheck={false} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5"/></label><label className="block text-sm font-medium">{t("auth.password")}<input name="password" type="password" required minLength={6} maxLength={72} autoComplete="new-password" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5"/></label><label className="block text-sm font-medium">{t("admin.confirmPassword")}<input name="password_confirmation" type="password" required minLength={6} maxLength={72} autoComplete="new-password" className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5"/></label></>:<p className="text-sm"><span className="font-medium">{t("auth.username")}:</span> {employee?.username||t("admin.legacyAccount")}</p>}
    {!invite?<label className="block text-sm font-medium">{t("admin.displayName")}<input name="full_name" required maxLength={200} defaultValue={employee?.full_name??""} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5"/></label>:null}
    {invite ? <div className="block text-sm font-medium">{t("admin.role")}<p className="mt-2 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2.5">{t("admin.salesperson")}</p></div> : <label className="block text-sm font-medium">{t("admin.role")}<select name="role" defaultValue={employee?.role??"salesperson"} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">{ADMIN_ROLES.map(role=><option key={role} value={role}>{t(`admin.${role}`)}</option>)}</select></label>}
    <label className="block text-sm font-medium">{t("fields.shop")}<select name="shop_id" required={invite} defaultValue={employee?.shop_id??""} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">{t("common.unassigned")}</option>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
    {!invite?<label className="flex items-center gap-3"><input name="is_active" type="checkbox" defaultChecked={employee?.is_active}/><span className="text-sm font-medium">Active account</span></label>:null}
    <div className="flex flex-col gap-3 sm:flex-row"><button disabled={pending} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">{pending?t("common.saving"):invite?t("admin.createAccount"):t("common.save")}</button><Link href="/admin/employees" className="px-5 py-2.5 text-center text-sm">{t("common.cancel")}</Link></div>
  </form>;
}

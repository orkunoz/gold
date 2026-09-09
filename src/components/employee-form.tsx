"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { EmployeeRole } from "@/lib/database.types";
import type { AdminState } from "@/lib/admin/actions";
import { ADMIN_ROLES } from "@/lib/admin/validation";

type Action=(state:AdminState,form:FormData)=>Promise<AdminState>; type Shop={id:string;name:string};
type Employee={full_name:string|null;email:string|null;role:EmployeeRole;shop_id:string|null;is_active:boolean};
export function EmployeeForm({action,shops,employee,invite=false}:{action:Action;shops:Shop[];employee?:Employee;invite?:boolean}) {
  const [state,formAction,pending]=useActionState(action,{error:""});
  function confirmSensitive(event: React.FormEvent<HTMLFormElement>) {
    if(!employee)return; const data=new FormData(event.currentTarget);
    const deactivating=employee.is_active&&!data.has("is_active");
    const downgradingOwner=employee.role==="owner"&&data.get("role")!=="owner";
    if((deactivating||downgradingOwner)&&!window.confirm("Confirm this sensitive employee account change."))event.preventDefault();
  }
  return <form action={formAction} onSubmit={confirmSensitive} className="max-w-2xl space-y-5">
    {state.error?<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{state.error}</p>:null}{state.success?<p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{state.success}</p>:null}
    {invite?<label className="block text-sm font-medium">Email<input name="email" type="email" required maxLength={320} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5"/></label>:<p className="text-sm"><span className="font-medium">Email:</span> {employee?.email||"Not recorded"}</p>}
    <label className="block text-sm font-medium">Full name<input name="full_name" required maxLength={200} defaultValue={employee?.full_name??""} className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5"/></label>
    <label className="block text-sm font-medium">Role<select name="role" defaultValue={employee?.role??"salesperson"} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5">{ADMIN_ROLES.map(role=><option key={role} value={role}>{role}</option>)}</select></label>
    <label className="block text-sm font-medium">Assigned shop<select name="shop_id" defaultValue={employee?.shop_id??""} className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5"><option value="">No shop (Owner only)</option>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
    {!invite?<label className="flex items-center gap-3"><input name="is_active" type="checkbox" defaultChecked={employee?.is_active}/><span className="text-sm font-medium">Active employee</span></label>:null}
    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Managers and salespeople require an active shop. Changing or deactivating an Owner is protected if they are the last active Owner.</p>
    <div className="flex gap-3"><button disabled={pending} className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white">{pending?"Saving…":invite?"Send invitation":"Save employee"}</button><Link href="/admin/employees" className="px-5 py-2.5 text-sm">Cancel</Link></div>
  </form>;
}

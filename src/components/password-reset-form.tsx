"use client";
import { useActionState } from "react";
import type { AdminState } from "@/lib/admin/actions";

export function PasswordResetForm({action}:{action:(state:AdminState,form:FormData)=>Promise<AdminState>}){
  const[state,formAction,pending]=useActionState(action,{error:""});
  return <form action={formAction} onSubmit={(event)=>{if(!window.confirm("Reset this account password?"))event.preventDefault();}} className="mt-10 max-w-2xl space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
    <div><h2 className="text-lg font-semibold">Reset password</h2><p className="mt-1 text-sm text-stone-600">The current password is never displayed.</p></div>
    {state.error?<p role="alert" className="text-sm text-red-700">{state.error}</p>:null}{state.success?<p role="status" className="text-sm text-emerald-800">{state.success}</p>:null}
    <label className="block text-sm font-medium">New password<input name="new_password" type="password" required minLength={6} maxLength={72} autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-white px-3 py-2.5"/></label>
    <label className="block text-sm font-medium">Confirm password<input name="password_confirmation" type="password" required minLength={6} maxLength={72} autoComplete="new-password" className="mt-2 w-full rounded-lg border bg-white px-3 py-2.5"/></label>
    <button disabled={pending} className="rounded-lg bg-amber-900 px-5 py-2.5 text-sm font-medium text-white">{pending?"Resetting…":"Reset password"}</button>
  </form>;
}

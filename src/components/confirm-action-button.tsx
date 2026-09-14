"use client";
import {useRef} from "react";
import {useFormStatus} from "react-dom";
import {useI18n} from "./i18n-provider";
function SubmitButton({label,danger}:{label:string;danger:boolean}){const{pending}=useFormStatus();return <button disabled={pending} aria-busy={pending} className={danger?"rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50":"text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50"}>{pending?"…":label}</button>}
export function ConfirmActionButton({action,label,title,name,message,danger=false}:{action:()=>Promise<void>;label:string;title?:string;name?:string;message:string;danger?:boolean}){
  const{t}=useI18n();
  const dialog=useRef<HTMLDialogElement>(null);
  if(!danger)return <form action={action}><SubmitButton label={label} danger={false}/></form>;
  return <><button type="button" onClick={()=>dialog.current?.showModal()} className="text-sm font-medium text-red-700 hover:underline">{label}</button><dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-stone-200 bg-white p-0 shadow-2xl backdrop:bg-stone-950/50"><div className="p-6"><h2 className="text-xl font-semibold">{title??label}</h2>{name?<p className="mt-3 font-semibold">{name}</p>:null}<p className="mt-3 whitespace-pre-line text-sm text-stone-600">{message}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>dialog.current?.close()} className="rounded-lg px-4 py-2 text-sm font-medium">{t("common.cancel")}</button><form action={action}><SubmitButton label={label} danger/></form></div></div></dialog></>;
}

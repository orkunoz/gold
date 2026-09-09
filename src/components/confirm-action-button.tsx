"use client";
export function ConfirmActionButton({action,label,message,danger=false}:{action:()=>Promise<void>;label:string;message:string;danger?:boolean}){return <form action={action} onSubmit={(event)=>{if(!window.confirm(message))event.preventDefault();}}><button className={`text-sm font-medium hover:underline ${danger?"text-red-700":"text-emerald-700"}`}>{label}</button></form>;}

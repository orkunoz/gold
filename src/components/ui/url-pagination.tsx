"use client";

import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {useCallback} from "react";
import {useI18n} from "@/components/i18n-provider";
import {Pagination} from "./pagination";

export function pageHref(pathname:string,currentQuery:string,page:number){
 const params=new URLSearchParams(currentQuery);
 if(page<=1)params.delete("page");else params.set("page",String(page));
 return `${pathname}${params.size?`?${params.toString()}`:""}`;
}

export function UrlPagination({page,count,label}:{page:number;count:number;label:string}){
 const router=useRouter(),pathname=usePathname(),searchParams=useSearchParams(),{t}=useI18n();
 const onPageChange=useCallback((next:number)=>router.push(pageHref(pathname,searchParams.toString(),next),{scroll:false}),[pathname,router,searchParams]);
 const pageLabel=useCallback((value:number)=>`${label} ${value}`,[label]);
 return <Pagination count={count} page={page} onPageChange={onPageChange} label={label} previousLabel={t("common.previous")} nextLabel={t("common.next")} pageLabel={pageLabel}/>;
}

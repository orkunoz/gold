"use client";

import {useEffect,useState,useSyncExternalStore} from "react";
import {motion,useReducedMotion} from "motion/react";

export type PaginationItem=number|"gap-l"|"gap-r";
const CELL={type:"spring",stiffness:520,damping:34,mass:.45} as const;
const STILL={duration:0} as const;
const GAP=4;
const slotFor=(digits:number)=>Math.max(32,18+digits*8);
const range=(from:number,to:number)=>Array.from({length:Math.max(0,to-from+1)},(_,i)=>from+i);
const compactQuery="(max-width: 639px)";
const subscribeCompact=(listener:()=>void)=>{const media=window.matchMedia(compactQuery);media.addEventListener("change",listener);return()=>media.removeEventListener("change",listener)};
const getCompact=()=>window.matchMedia(compactQuery).matches;

export function paginate(page:number,count:number,siblings=2,boundaries=1):PaginationItem[]{
 const total=Math.max(1,Math.floor(count)),s=Math.max(0,Math.floor(siblings)),b=Math.max(1,Math.floor(boundaries));
 const current=Math.min(total,Math.max(1,Math.floor(page)||1));
 const visible=2*b+2*s+3;
 if(total<=visible)return range(1,total);
 if(current<b+s+2)return [...range(1,2*s+b+2),"gap-r",...range(total-b+1,total)];
 if(current>total-b-s-1)return [...range(1,b),"gap-l",...range(total-2*s-b-1,total)];
 return [...range(1,b),"gap-l",...range(current-s,current+s),"gap-r",...range(total-b+1,total)];
}

export type PaginationProps={count:number;page:number;onPageChange:(page:number)=>void;previousLabel:string;nextLabel:string;pageLabel:(page:number)=>string;label:string;siblings?:number;boundaries?:number;className?:string};

function Chevron({flip=false}:{flip?:boolean}){return <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" className={flip?"-scale-x-100":undefined}><path d="M4.75 2.75 8 6l-3.25 3.25" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}

export function Pagination({count,page,onPageChange,previousLabel,nextLabel,pageLabel,label,siblings=2,boundaries=1,className=""}:PaginationProps){
 const total=Math.max(1,Math.floor(count)),current=Math.min(total,Math.max(1,Math.floor(page)||1));
 const compact=useSyncExternalStore(subscribeCompact,getCompact,()=>false);
 const items=paginate(current,total,compact?Math.min(siblings,1):siblings,boundaries),reduced=useReducedMotion(),slot=slotFor(String(total).length);
 const thumbIndex=items.indexOf(current);
 const [spoken,setSpoken]=useState("");
 useEffect(()=>{const timer=setTimeout(()=>setSpoken(`${pageLabel(current)} / ${total}`),500);return()=>clearTimeout(timer)},[current,total,pageLabel]);
 const arrow="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-700 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent";
 return <nav aria-label={label} className={`inline-flex max-w-full ${className}`}><div className="flex max-w-full items-center overflow-x-auto" style={{gap:GAP}}>
  <button type="button" aria-label={previousLabel} disabled={current===1} onClick={()=>onPageChange(current-1)} className={arrow}><Chevron flip/></button>
  <div className="relative shrink-0"><motion.span aria-hidden initial={false} animate={{x:thumbIndex*(slot+GAP)}} transition={reduced?STILL:CELL} style={{width:slot,background:"var(--zl-stone-800)"}} className="absolute inset-y-0 left-0 rounded-[9px]"/><ol className="relative flex" style={{gap:GAP}}>{items.map(item=>typeof item!=="number"?<li key={item} aria-hidden style={{width:slot}} className="flex h-8 items-center justify-center text-xs text-stone-400">…</li>:<li key={item} style={{width:slot}}><button type="button" aria-label={pageLabel(item)} aria-current={item===current?"page":undefined} onClick={()=>onPageChange(item)} className={`flex h-8 w-full items-center justify-center rounded-[9px] text-[12.5px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-700 ${item===current?"font-semibold text-[var(--zl-page)]":"text-stone-500 hover:bg-stone-100 hover:text-stone-800"}`}>{item}</button></li>)}</ol></div>
  <button type="button" aria-label={nextLabel} disabled={current===total} onClick={()=>onPageChange(current+1)} className={arrow}><Chevron/></button>
 </div><span role="status" className="sr-only">{spoken}</span></nav>;
}

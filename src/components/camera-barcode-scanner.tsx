"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {normalizeScannedBarcode} from "@/lib/inventory/scanner";
import {useI18n} from "./i18n-provider";

type DetectorResult={rawValue:string};
type Detector=new(options?:{formats?:string[]} )=>{detect(source:HTMLVideoElement):Promise<DetectorResult[]>};

export function CameraBarcodeScanner({onDetected,returnFocus}:{onDetected:(value:string)=>void;returnFocus:React.RefObject<HTMLInputElement|null>}){
 const{t}=useI18n(),dialog=useRef<HTMLDialogElement>(null),video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),cancelled=useRef(false);
 const[devices,setDevices]=useState<MediaDeviceInfo[]>([]),[deviceId,setDeviceId]=useState(""),[error,setError]=useState("");
 const stop=useCallback(()=>{cancelled.current=true;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(video.current)video.current.srcObject=null},[]);
 const close=useCallback(()=>{stop();dialog.current?.close();queueMicrotask(()=>returnFocus.current?.focus())},[returnFocus,stop]);
 useEffect(()=>stop,[stop]);
 async function detect(){
  const element=video.current;if(!element)return;
  try{
   const Native=(globalThis as typeof globalThis&{BarcodeDetector?:Detector}).BarcodeDetector;
   if(Native){
    const detector=new Native({formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39","codabar","itf"]});
    while(!cancelled.current){const result=await detector.detect(element);if(result[0]?.rawValue){success(result[0].rawValue);return}await new Promise(resolve=>setTimeout(resolve,120))}
   }else{
    const {BrowserMultiFormatReader}=await import("@zxing/library");
    const reader=new BrowserMultiFormatReader();
    const result=await reader.decodeFromVideoElement(element);if(!cancelled.current)success(result.getText());
   }
  }catch{if(!cancelled.current)setError(t("inventory.scanner.unreadable"));}
 }
 function success(raw:string){const value=normalizeScannedBarcode(raw);if(!value)return;stop();dialog.current?.close();onDetected(value);queueMicrotask(()=>returnFocus.current?.focus())}
 async function start(selected=""){
  stop();cancelled.current=false;setError("");
  if(!navigator.mediaDevices?.getUserMedia){setError(t("inventory.scanner.unsupported"));return}
  try{
   const media=await navigator.mediaDevices.getUserMedia({video:selected?{deviceId:{exact:selected}}:{facingMode:{ideal:"environment"}},audio:false});
   stream.current=media;if(video.current){video.current.srcObject=media;await video.current.play()}
   const available=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput");setDevices(available);
   const active=media.getVideoTracks()[0]?.getSettings().deviceId??selected;if(active)setDeviceId(active);
   void detect();
  }catch(cause){const name=cause instanceof DOMException?cause.name:"";setError(name==="NotAllowedError"?t("inventory.scanner.denied"):name==="NotFoundError"?t("inventory.scanner.noCamera"):t("inventory.scanner.unavailable"));stop()}
 }
 function open(){dialog.current?.showModal();void start()}
 return <><button type="button" onClick={open} className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold hover:bg-stone-50">{t("inventory.scanner.scan")}</button>
 <dialog ref={dialog} onCancel={event=>{event.preventDefault();close()}} aria-labelledby="barcode-scanner-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-white p-0 shadow-2xl backdrop:bg-black/60">
  <div className="p-5"><h2 id="barcode-scanner-title" className="text-lg font-semibold">{t("inventory.scanner.title")}</h2><p className="mt-1 text-sm text-stone-600">{t("inventory.scanner.instruction")}</p>
   <video ref={video} muted playsInline className="mt-4 aspect-video w-full rounded-xl bg-black object-cover"/>
   {devices.length>1?<label className="mt-4 block text-sm font-medium">{t("inventory.scanner.camera")}<select value={deviceId} onChange={e=>{setDeviceId(e.target.value);void start(e.target.value)}} className="mt-2 w-full rounded-lg border px-3 py-2">{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||t("inventory.scanner.cameraNumber",{number:i+1})}</option>)}</select></label>:null}
   {error?<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>:null}
  </div><div className="flex justify-end border-t bg-stone-50 p-4"><button type="button" onClick={close} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">{t("common.cancel")}</button></div>
 </dialog></>;
}

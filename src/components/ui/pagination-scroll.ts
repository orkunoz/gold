export const PAGINATION_SCROLL_DURATION_MS=450;

let activeFrame:number|null=null;

export function scrollToTopForPagination(){
 if(typeof window==="undefined")return;
 if(activeFrame!==null)window.cancelAnimationFrame(activeFrame);
 activeFrame=null;
 const startY=window.scrollY;
 if(startY<=0||window.matchMedia("(prefers-reduced-motion: reduce)").matches){window.scrollTo(0,0);return}
 const startTime=window.performance.now();
 const step=(time:number)=>{
  const progress=Math.min(1,Math.max(0,(time-startTime)/PAGINATION_SCROLL_DURATION_MS));
  window.scrollTo(0,startY*Math.pow(1-progress,3));
  activeFrame=progress<1?window.requestAnimationFrame(step):null;
 };
 activeFrame=window.requestAnimationFrame(step);
}

export function positiveInventoryWeight(value:string|undefined):number|null{
 const text=value?.trim();
 if(!text||!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text))return null;
 const number=Number(text);
 return Number.isFinite(number)&&number>0?number:null;
}

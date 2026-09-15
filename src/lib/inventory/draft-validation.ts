import type {DraftProduct} from "./actions";
export type RequiredDraftField="category_name"|"producer"|"weight_grams"|"price_per_gram"|"shop_id";
export const requiredDraftFields:RequiredDraftField[]=["category_name","producer","weight_grams","price_per_gram","shop_id"];
export function draftValidation(draft:DraftProduct){const errors:Partial<Record<RequiredDraftField,"required"|"invalid">>={};for(const field of requiredDraftFields)if(!draft[field].trim())errors[field]="required";for(const field of ["weight_grams","price_per_gram"] as const)if(draft[field].trim()&&(!Number.isFinite(Number(draft[field]))||Number(draft[field])<=0))errors[field]="invalid";return errors}

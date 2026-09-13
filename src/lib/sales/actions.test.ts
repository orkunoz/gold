import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "@/lib/i18n/core";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),employee:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/inventory/queries",()=>({getCurrentEmployee:mocks.employee}));
vi.mock("@/lib/i18n/server",()=>({getTranslations:async()=>({locale:"ua",t:createTranslator("ua")})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { completeSaleAction } from "./actions";
beforeEach(()=>{vi.clearAllMocks();mocks.employee.mockResolvedValue({id:"employee"});mocks.rpc.mockResolvedValue({data:[{sale_id:"sale"}],error:null});});
describe("sale completion",()=>{
  it("does not accept or submit checkout notes",async()=>{
    expect((await completeSaleAction({shopId:"shop",items:[{inventory_item_id:"item",discount_percent:0}]})).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_sale",{p_shop_id:"shop",p_items:[{inventory_item_id:"item",discount_percent:0}],p_notes:undefined});
  });
  it("preserves authentication and localizes sale failures",async()=>{
    mocks.rpc.mockResolvedValue({error:{message:"IN_STOCK"}});
    const result=await completeSaleAction({shopId:"shop",items:[{}]});
    expect(mocks.employee).toHaveBeenCalled();
    expect(result).toEqual({success:false,error:createTranslator("ua")("sales.errors.unavailable")});
  });
});

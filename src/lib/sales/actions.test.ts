import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "@/lib/i18n/core";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),employee:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/inventory/queries",()=>({getCurrentEmployee:mocks.employee}));
vi.mock("@/lib/i18n/server",()=>({getTranslations:async()=>({locale:"ua",t:createTranslator("ua")})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { completeSaleAction } from "./actions";
beforeEach(()=>{vi.clearAllMocks();mocks.employee.mockResolvedValue({id:"employee"});mocks.rpc.mockResolvedValue({data:[{sale_id:"sale"}],error:null});});
describe("sale notes",()=>{
  it("passes long Unicode notes safely as an RPC parameter",async()=>{
    const notes="Примітка <script> ' & \n".repeat(400);
    expect(notes.length).toBeGreaterThan(5000);
    expect((await completeSaleAction({shopId:"shop",items:[{inventory_item_id:"item",discount_percent:0}],notes})).success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_sale",expect.objectContaining({p_notes:notes}));
  });
  it("keeps notes optional and rejects non-text input",async()=>{
    expect((await completeSaleAction({shopId:"shop",items:[{}],notes:null})).success).toBe(true);
    mocks.rpc.mockClear();
    expect((await completeSaleAction({shopId:"shop",items:[{}],notes:42 as unknown as string})).success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves authentication and localizes sale failures",async()=>{
    mocks.rpc.mockResolvedValue({error:{message:"IN_STOCK"}});
    const result=await completeSaleAction({shopId:"shop",items:[{}],notes:null});
    expect(mocks.employee).toHaveBeenCalled();
    expect(result).toEqual({success:false,error:createTranslator("ua")("sales.errors.unavailable")});
  });
});

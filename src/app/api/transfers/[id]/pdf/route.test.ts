import { describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({getTransfer:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/transfers/queries",()=>({getTransfer:mocks.getTransfer}));
import { GET, runtime } from "./route";

describe("GET /api/transfers/[id]/pdf",()=>{
  it("loads the stored transfer by id and returns downloadable PDF bytes",async()=>{
    mocks.getTransfer.mockResolvedValue({transfer:{transfer_number:"TR-20260913-000123",transferred_at:"2026-09-13T12:00:00Z",source_name:"Склад",destination_name:"Камінь",source_address:null,destination_address:null,performed_by_name:"Власник",total_weight:2.5,total_value:38320},items:[]});
    const response=await GET(new Request("https://example.test/api/transfers/transfer-id/pdf"),{params:Promise.resolve({id:"transfer-id"})});
    const bytes=new Uint8Array(await response.arrayBuffer());
    expect(runtime).toBe("nodejs");
    expect(mocks.getTransfer).toHaveBeenCalledWith("transfer-id");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="transfer-000123.pdf"');
    expect(response.headers.get("content-length")).toBe(String(bytes.byteLength));
    expect(new TextDecoder().decode(bytes.subarray(0,8))).toBe("%PDF-1.7");
  });
});

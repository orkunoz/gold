import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
const {query}=vi.hoisted(()=>{
 const query={select:vi.fn(),order:vi.fn(),range:vi.fn(),ilike:vi.fn(),eq:vi.fn(),gte:vi.fn(),lt:vi.fn()};
 for(const method of Object.values(query))method.mockReturnValue(query);
 return {query};
});
vi.mock("@/lib/supabase/server",()=>({createClient:vi.fn(async()=>({from:vi.fn(()=>query)}))}));
vi.mock("@/lib/supabase/read",()=>({readWithRetry:vi.fn(async()=>({data:[],count:0,error:null}))}));

import {getInventoryItems} from "./queries";

describe("inventory database filters",()=>{
 beforeEach(()=>{for(const method of Object.values(query))method.mockClear()});
 it("combines exact Producer, Size, numeric Weight, status and shop before paging",async()=>{
  await getInventoryItems({producer:"Maker",size:"17,5-18,5",weight:"2.350",status:"SOLD",shop:"shop-1",article:"A-1"},2,25,"weight","asc");
  expect(query.eq).toHaveBeenCalledWith("producer","Maker");
  expect(query.eq).toHaveBeenCalledWith("size","17,5-18,5");
  expect(query.eq).toHaveBeenCalledWith("weight_grams",2.35);
  expect(query.eq).toHaveBeenCalledWith("status","SOLD");
  expect(query.eq).toHaveBeenCalledWith("shop_id","shop-1");
  expect(query.ilike).toHaveBeenCalledWith("article_number","%A-1%");
  expect(query.range).toHaveBeenCalledWith(25,49);
  expect(query.order).toHaveBeenCalledWith("weight_grams",{ascending:true,nullsFirst:false});
 });
 it("ignores invalid or empty Weight without weakening the existing status filter",async()=>{
  await getInventoryItems({weight:"-2",status:"IN_STOCK"});
  expect(query.eq).not.toHaveBeenCalledWith("weight_grams",expect.anything());
  expect(query.eq).toHaveBeenCalledWith("status","IN_STOCK");
 });
});

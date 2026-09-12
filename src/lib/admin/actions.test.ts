import {beforeEach,describe,expect,it,vi} from "vitest";

const mocks=vi.hoisted(()=>({requireOwner:vi.fn(),rpc:vi.fn(),select:vi.fn(),createUser:vi.fn(),deleteUser:vi.fn(),updateUserById:vi.fn(),listUsers:vi.fn(),revalidatePath:vi.fn()}));
vi.mock("./queries",()=>({requireOwner:mocks.requireOwner}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc,from:()=>({select:()=>({eq:()=>({maybeSingle:mocks.select})})})})}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({auth:{admin:{createUser:mocks.createUser,deleteUser:mocks.deleteUser,updateUserById:mocks.updateUserById,listUsers:mocks.listUsers}}})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidatePath}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
import {createEmployeeAccount,resetEmployeePassword} from "./actions";

function accountForm(username="test_account",password="safe-pass-1",shop="shop-1"){const form=new FormData();form.set("username",username);form.set("password",password);form.set("password_confirmation",password);form.set("shop_id",shop);return form;}
function resetForm(password="new-safe-pass"){const form=new FormData();form.set("new_password",password);form.set("password_confirmation",password);return form;}

beforeEach(()=>{vi.clearAllMocks();mocks.listUsers.mockResolvedValue({data:{users:[]},error:null});mocks.createUser.mockResolvedValue({data:{user:{id:"auth-1"}},error:null});mocks.rpc.mockResolvedValue({error:null});});

describe("Owner account actions",()=>{
 it("creates only the internal username identity and links a salesperson",async()=>{const result=await createEmployeeAccount({error:""},accountForm(" Test_Account "));expect(result.success).toContain("test_account");expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({email:"test_account@internal.local",email_confirm:true}));expect(mocks.rpc).toHaveBeenCalledWith("admin_link_employee_account",expect.objectContaining({p_username:"test_account",p_role:"salesperson",p_shop_id:"shop-1"}));});
 it("rejects mismatched passwords before using the Admin API",async()=>{const form=accountForm();form.set("password_confirmation","different");expect((await createEmployeeAccount({error:""},form)).error).toContain("match");expect(mocks.createUser).not.toHaveBeenCalled();});
 it("removes only a newly created Auth user when database linking fails",async()=>{mocks.rpc.mockResolvedValue({error:{message:"link failed"}});await createEmployeeAccount({error:""},accountForm());expect(mocks.deleteUser).toHaveBeenCalledWith("auth-1");});
 it("resets the selected linked account without reading an existing password",async()=>{mocks.select.mockResolvedValue({data:{auth_user_id:"auth-2",username:"test_account"},error:null});mocks.updateUserById.mockResolvedValue({error:null});const result=await resetEmployeePassword("employee-2",{error:""},resetForm());expect(result.success).toContain("test_account");expect(mocks.updateUserById).toHaveBeenCalledWith("auth-2",{password:"new-safe-pass"});});
 it("rejects invalid reset confirmation before calling the Admin API",async()=>{const form=resetForm();form.set("password_confirmation","different");expect((await resetEmployeePassword("employee-2",{error:""},form)).error).toContain("match");expect(mocks.updateUserById).not.toHaveBeenCalled();});
});

"use server";
import {revalidatePath} from "next/cache"; import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server"; import {createAdminClient} from "@/lib/supabase/admin"; import {requireOwner} from "./queries"; import {ADMIN_ROLES,friendlyAdminError,normalizeShopCode,normalizeUsername,validUsername} from "./validation"; import type {EmployeeRole} from "@/lib/database.types";
export type AdminState={error:string;success?:string};
const value=(form:FormData,name:string)=>String(form.get(name)??"").trim();
export async function createShop(_state:AdminState,form:FormData):Promise<AdminState>{await requireOwner();const name=value(form,"name"),code=normalizeShopCode(value(form,"code"));if(!name||name.length>200||!code||code.length>40)return{error:"Enter a valid shop name and code."};const db=await createClient();const{error}=await db.rpc("admin_create_shop",{p_name:name,p_code:code});if(error)return{error:error.code==="23505"?"Shop code already exists.":"Unable to create shop."};revalidatePath("/admin");redirect("/admin/shops");}
export async function updateShop(id:string,_state:AdminState,form:FormData):Promise<AdminState>{await requireOwner();const name=value(form,"name"),code=normalizeShopCode(value(form,"code"));const db=await createClient();const{error}=await db.rpc("admin_update_shop",{p_shop_id:id,p_name:name,p_code:code});if(error)return{error:error.code==="23505"?"Shop code already exists.":"Unable to update shop."};revalidatePath("/admin");redirect("/admin/shops");}
export async function setShopActive(id:string,active:boolean){await requireOwner();const db=await createClient();const{error}=await db.rpc("admin_set_shop_active",{p_shop_id:id,p_active:active});if(error)redirect(`/admin/shops?error=${encodeURIComponent(friendlyAdminError(error.message))}`);revalidatePath("/admin");redirect("/admin/shops");}
export async function updateEmployee(id:string,_state:AdminState,form:FormData):Promise<AdminState>{await requireOwner();const role=value(form,"role") as EmployeeRole,shop=value(form,"shop_id")||null,active=form.get("is_active")==="on";if(!ADMIN_ROLES.includes(role))return{error:"Select a valid role."};const db=await createClient();const{error}=await db.rpc("admin_update_employee",{p_employee_id:id,p_full_name:value(form,"full_name"),p_role:role,p_shop_id:shop,p_active:active});if(error)return{error:friendlyAdminError(error.message)};revalidatePath("/admin");redirect("/admin/employees");}
async function findAuthUser(email:string){const admin=createAdminClient();for(let page=1;page<=10;page++){const{data,error}=await admin.auth.admin.listUsers({page,perPage:1000});if(error)throw error;const found=data.users.find(user=>user.email?.toLowerCase()===email);if(found)return found;if(data.users.length<1000)break;}return null;}
export async function createEmployeeAccount(_state:AdminState,form:FormData):Promise<AdminState>{
  await requireOwner();
  const username=normalizeUsername(value(form,"username")),password=String(form.get("password")??""),confirmation=String(form.get("password_confirmation")??""),fullName=username,shop=value(form,"shop_id")||null;
  if(!validUsername(username)||!shop)return{error:"Enter a valid username and shop."};
  if(password!==confirmation)return{error:"Passwords do not match."};
  if(password.length<6||password.length>72)return{error:"Password must be between 6 and 72 characters."};
  const email=`${username}@internal.local`; let created=false;
  try{
    const admin=createAdminClient(); let user=await findAuthUser(email);
    if(!user){const result=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username,full_name:fullName}});if(result.error||!result.data.user)throw result.error??new Error("Account creation failed.");user=result.data.user;created=true;}
    const db=await createClient(); const{error}=await db.rpc("admin_link_employee_account",{p_auth_user_id:user.id,p_username:username,p_full_name:fullName,p_role:"salesperson",p_shop_id:shop});
    if(error){if(created)await admin.auth.admin.deleteUser(user.id);return{error:friendlyAdminError(error.message)};}
  }catch{return{error:"The account could not be created. It is safe to retry."};}
  revalidatePath("/admin"); return{error:"",success:`Account ${username} created.`};
}

export async function resetEmployeePassword(id:string,_state:AdminState,form:FormData):Promise<AdminState>{
  await requireOwner(); const password=String(form.get("new_password")??""),confirmation=String(form.get("password_confirmation")??"");
  if(password!==confirmation)return{error:"Passwords do not match."}; if(password.length<6||password.length>72)return{error:"Password must be between 6 and 72 characters."};
  const db=await createClient();const{data,error}=await db.from("employees").select("auth_user_id,username").eq("id",id).maybeSingle();if(error||!data)return{error:"Account not found."};
  try{const admin=createAdminClient();const result=await admin.auth.admin.updateUserById(data.auth_user_id,{password});if(result.error)throw result.error;}catch{return{error:"Password reset failed. Please try again."};}
  return{error:"",success:`Password reset for ${data.username??"account"}.`};
}
export async function deleteEmployeeAccount(id:string){
  await requireOwner();const db=await createClient();const{data:authUserId,error}=await db.rpc("admin_prepare_account_deletion",{p_employee_id:id});
  if(error||!authUserId)redirect(`/admin/employees?error=${encodeURIComponent(friendlyAdminError(error?.message??"Account not found."))}`);
  try{const result=await createAdminClient().auth.admin.deleteUser(authUserId);if(result.error)throw result.error;}catch{redirect(`/admin/employees?error=${encodeURIComponent("Account deletion failed. Please try again.")}`);}
  revalidatePath("/admin");redirect("/admin/employees");
}
export async function deleteShop(id:string){await requireOwner();const db=await createClient();const{error}=await db.rpc("admin_delete_shop",{p_shop_id:id});if(error)redirect(`/admin/shops?error=${encodeURIComponent(friendlyAdminError(error.message))}`);revalidatePath("/admin");revalidatePath("/inventory");redirect("/admin/shops");}

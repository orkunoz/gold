import {notFound} from "next/navigation";
import {EmployeeForm} from "@/components/employee-form";
import {PasswordResetForm} from "@/components/password-reset-form";
import {resetEmployeePassword,updateEmployee} from "@/lib/admin/actions";
import {getAdminData} from "@/lib/admin/queries";

export default async function EditEmployeePage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const{employees,shops}=await getAdminData();const employee=employees.find(x=>x.id===id);if(!employee)notFound();
  return <section><h1 className="text-3xl font-semibold">Edit account</h1><div className="mt-8"><EmployeeForm action={updateEmployee.bind(null,id)} employee={employee} shops={shops.filter(x=>x.is_active)}/></div><PasswordResetForm action={resetEmployeePassword.bind(null,id)}/></section>;
}

import { staffCase } from "@/lib/support/service";
import { query } from "@/lib/custom/service";
import { id } from "@/lib/custom/model";
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{caseId:string;attachmentId:string}>}){
 try{
  const {caseId,attachmentId}=await params,{c}=await staffCase(caseId);
  const file=(await query('SELECT file_name,mime,body FROM support_case_attachments WHERE id=$1 AND case_id=$2 AND organization_id=$3',[id(attachmentId),c.id,c.organization_id]))[0];
  if(!file)return Response.json({error:'File unavailable'},{status:404});
  return new Response(Buffer.from(String(file.body),'base64'),{headers:{'Cache-Control':'private, no-store','Content-Type':String(file.mime),'Content-Disposition':`attachment; filename="${file.file_name}"`,'X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Access denied'},{status:403});}
}

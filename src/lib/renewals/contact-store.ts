import "server-only";
import { query } from "@/lib/custom/service";
import type { communicationInput } from "./details";
export async function saveCommunicationDetails(org: string, input: ReturnType<typeof communicationInput>, actor: string) {
  const rows = await query(
    `WITH changed AS(INSERT INTO business_communication_profiles(organization_id,business_name,contact_name,billing_email,phone,additional_emails,client_status,notes,updated_by)
     SELECT id,$2,$3,$4,$5,$6::text[],$7,$8,$10 FROM organizations WHERE id=$1 AND $9::int=0
     ON CONFLICT(organization_id) DO NOTHING RETURNING *),edited AS(
     UPDATE business_communication_profiles SET business_name=$2,contact_name=$3,billing_email=$4,phone=$5,additional_emails=$6::text[],client_status=$7,notes=$8,revision=revision+1,updated_by=$10,updated_at=now()
     WHERE organization_id=$1 AND revision=$9 AND $9::int>0 RETURNING *)
     INSERT INTO renewal_audit(actor_id,event,item_key,detail) SELECT $10,'BUSINESS_COMMUNICATION_DETAILS_SAVED','business:'||organization_id::text,jsonb_build_object('revision',revision,'businessName',business_name,'contactName',contact_name,'billingEmail',billing_email,'additionalEmails',additional_emails,'phone',phone,'clientStatus',client_status,'notes',notes,'loginChanged',false) FROM(SELECT * FROM changed UNION ALL SELECT * FROM edited) saved RETURNING id`,
    [org,input.businessName,input.contactName,input.billingEmail,input.phone,input.additionalEmails,input.clientStatus,input.notes,input.revision,actor],
  );
  if (!rows.length) throw Error("Current business details changed. Refresh before saving again.");
}

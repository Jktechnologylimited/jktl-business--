import { footerManagerDataAction } from "@/lib/actions/mail-admin-actions";
import { PromotionalFooter } from "./promotional-footer";
export default async function PromotionSettings() {
  return <PromotionalFooter initial={await footerManagerDataAction()} />;
}

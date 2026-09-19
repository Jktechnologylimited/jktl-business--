import type { ActionResult } from "@/lib/actions/types";
import { createCustomerAction, updateCustomerAction, deleteCustomerAction } from "@/lib/actions/customer-actions";
import { createServiceAction, updateServiceAction, deleteServiceAction } from "@/lib/actions/service-actions";
import { createProductAction, updateProductAction, deleteProductAction } from "@/lib/actions/product-actions";
import { createTestimonialAction, updateTestimonialAction, deleteTestimonialAction } from "@/lib/actions/testimonial-actions";
import { createBookingAction, updateBookingAction, updateBookingStatusAction, deleteBookingAction } from "@/lib/actions/booking-actions";
import { createSaleAction, updateSalePaymentAction } from "@/lib/actions/sale-actions";
import { createExpenseAction, deleteExpenseAction } from "@/lib/actions/expense-actions";
import { createInvoiceAction, updateInvoiceStatusAction, deleteInvoiceAction } from "@/lib/actions/invoice-actions";
import { adjustStockAction } from "@/lib/actions/inventory-actions";
import { addMemberAction, removeMemberAction } from "@/lib/actions/member-actions";
import { updateAccountAction, setAvatarAction } from "@/lib/actions/account-actions";
import { updateBusinessProfileAction } from "@/lib/actions/business-actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => Promise<ActionResult<unknown>>;

/** Every mutation the offline store can queue, mapped to the Server Action
 * that replays it once back online. Keys are the outbox entry's `type`. */
export const MUTATION_HANDLERS: Record<string, Handler> = {
  "customer.create": (p) => createCustomerAction(p.id, p.input),
  "customer.update": (p) => updateCustomerAction(p.id, p.input),
  "customer.delete": (p) => deleteCustomerAction(p.id),

  "service.create": (p) => createServiceAction(p.id, p.input),
  "service.update": (p) => updateServiceAction(p.id, p.input),
  "service.delete": (p) => deleteServiceAction(p.id),

  "product.create": (p) => createProductAction(p.id, p.input),
  "product.update": (p) => updateProductAction(p.id, p.input),
  "product.delete": (p) => deleteProductAction(p.id),

  "testimonial.create": (p) => createTestimonialAction(p.id, p.input),
  "testimonial.update": (p) => updateTestimonialAction(p.id, p.input),
  "testimonial.delete": (p) => deleteTestimonialAction(p.id),

  "booking.create": (p) => createBookingAction(p.id, p.input),
  "booking.update": (p) => updateBookingAction(p.id, p.input),
  "booking.updateStatus": (p) => updateBookingStatusAction(p.id, p.status),
  "booking.delete": (p) => deleteBookingAction(p.id),

  "sale.create": (p) => createSaleAction(p.input),
  "sale.updatePayment": (p) => updateSalePaymentAction(p.id, p.patch),

  "expense.create": (p) => createExpenseAction(p.id, p.input),
  "expense.delete": (p) => deleteExpenseAction(p.id),

  "invoice.create": (p) => createInvoiceAction(p.input),
  "invoice.updateStatus": (p) => updateInvoiceStatusAction(p.id, p.status),
  "invoice.delete": (p) => deleteInvoiceAction(p.id),

  "inventory.adjust": (p) => adjustStockAction(p.productId, p.delta, p.reason),

  "member.add": (p) => addMemberAction(p.id, p.input),
  "member.remove": (p) => removeMemberAction(p.id),

  "account.update": (p) => updateAccountAction(p.patch),
  "account.setAvatar": (p) => setAvatarAction(p.dataUrl),

  "business.updateProfile": (p) => updateBusinessProfileAction(p.patch),
};

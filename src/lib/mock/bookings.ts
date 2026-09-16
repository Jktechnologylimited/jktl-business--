import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import type { Booking } from "@/lib/types";
import { ORG_ID } from "./business";

function at(day: Date, hour: number, minute: number): string {
  return setMinutes(setHours(startOfDay(day), hour), minute).toISOString();
}

export function demoBookings(now = new Date()): Booking[] {
  const today = now;
  const tomorrow = addDays(now, 1);
  const dayAfter = addDays(now, 2);

  return [
    // Today — roughly chronological, mixed statuses.
    { id: "bk_1", organizationId: ORG_ID, customerId: "cus_faith", serviceId: "svc_haircut", staffId: "usr_ada", startsAt: at(today, 8, 30), status: "completed", notes: "", priceKobo: 250_000 },
    { id: "bk_2", organizationId: ORG_ID, customerId: "cus_preye", serviceId: "svc_braiding", staffId: "usr_ibinabo", startsAt: at(today, 9, 0), status: "completed", notes: "", priceKobo: 800_000 },
    { id: "bk_3", organizationId: ORG_ID, customerId: "cus_ruth", serviceId: "svc_manicure", staffId: "usr_tonye", startsAt: at(today, 9, 30), status: "completed", notes: "", priceKobo: 400_000 },
    { id: "bk_4", organizationId: ORG_ID, customerId: "cus_comfort", serviceId: "svc_kids", staffId: "usr_ibinabo", startsAt: at(today, 10, 0), status: "completed", notes: "Brings her daughter too.", priceKobo: 500_000 },
    { id: "bk_5", organizationId: ORG_ID, customerId: "cus_grace", serviceId: "svc_pedicure", staffId: "usr_tonye", startsAt: at(today, 10, 30), status: "completed", notes: "", priceKobo: 450_000 },
    { id: "bk_6", organizationId: ORG_ID, customerId: "cus_doris", serviceId: "svc_wash", staffId: "usr_ada", startsAt: at(today, 11, 15), status: "confirmed", notes: "", priceKobo: 300_000 },
    { id: "bk_7", organizationId: ORG_ID, customerId: "cus_miebi", serviceId: "svc_haircut", staffId: "usr_ada", startsAt: at(today, 11, 45), status: "confirmed", notes: "Regular fade.", priceKobo: 250_000 },
    { id: "bk_8", organizationId: ORG_ID, customerId: "cus_chidinma", serviceId: "svc_style", staffId: "usr_ibinabo", startsAt: at(today, 12, 30), status: "confirmed", notes: "Check edge control brand first.", priceKobo: 600_000 },
    { id: "bk_9", organizationId: ORG_ID, customerId: "cus_ivie", serviceId: "svc_makeup", staffId: "usr_ada", startsAt: at(today, 13, 15), status: "confirmed", notes: "Bridal trial run.", priceKobo: 1_500_000 },
    { id: "bk_10", organizationId: ORG_ID, customerId: "cus_joy", serviceId: "svc_wash", staffId: "usr_tonye", startsAt: at(today, 14, 0), status: "pending", notes: "", priceKobo: 300_000 },
    { id: "bk_11", organizationId: ORG_ID, customerId: "cus_patience", serviceId: "svc_pedicure", staffId: "usr_tonye", startsAt: at(today, 15, 0), status: "pending", notes: "", priceKobo: 450_000 },
    { id: "bk_12", organizationId: ORG_ID, customerId: "cus_ebiere", serviceId: "svc_manicure", staffId: "usr_ibinabo", startsAt: at(today, 16, 30), status: "no_show", notes: "Did not call ahead.", priceKobo: 400_000 },

    // Upcoming — for the "Upcoming bookings" dashboard widget.
    { id: "bk_13", organizationId: ORG_ID, customerId: "cus_blessing", serviceId: "svc_braiding", staffId: "usr_ibinabo", startsAt: at(tomorrow, 9, 0), status: "confirmed", notes: "", priceKobo: 800_000 },
    { id: "bk_14", organizationId: ORG_ID, customerId: "cus_naomi", serviceId: "svc_style", staffId: "usr_ada", startsAt: at(tomorrow, 10, 30), status: "pending", notes: "", priceKobo: 600_000 },
    { id: "bk_15", organizationId: ORG_ID, customerId: "cus_ivie", serviceId: "svc_makeup", staffId: "usr_ada", startsAt: at(dayAfter, 11, 0), status: "confirmed", notes: "Wedding day — arrive early.", priceKobo: 1_500_000 },
  ];
}

import { setHours, setMinutes, startOfDay, subDays } from "date-fns";
import type { Sale, SaleItem } from "@/lib/types";
import { ORG_ID } from "./business";

function at(now: Date, daysAgo: number, hour: number, minute: number): string {
  return setMinutes(setHours(startOfDay(subDays(now, daysAgo)), hour), minute).toISOString();
}


/**
 * A deterministic spread of trading history.
 *
 * The demo used to be fifteen sales over eight days, against ₦426,000 of
 * monthly expenses — a salon losing ₦337,000 a month with a zero repeat rate.
 * That made the analytics screen read "at risk" and the repeat-customer signal
 * read 0%, which is a poor advertisement for a product whose whole argument is
 * that the numbers are worth looking at.
 *
 * So this generates a realistic two months for a three-staff salon: a rotating
 * cast of return clients, plausible service values, and enough spread that a
 * 30-day chart has shape. Generator and sale-item list share the same recipe,
 * so the two can never drift apart.
 *
 * Deterministic on purpose — no `Math.random` — so every demo, screenshot and
 * test sees exactly the same salon.
 */

/** [daysAgo, hour, minute, customerId, serviceRef, serviceName, serviceKobo, productRef?, productName?, productKobo?] */
function tradingRecipe(today: Date): Array<[number, number, number, string, string, string, number, string?, string?, number?]> {
  const clients = [
    "cus_faith", "cus_preye", "cus_ruth", "cus_comfort", "cus_grace",
    "cus_doris", "cus_miebi", "cus_ivie", "cus_chidinma", "cus_blessing",
  ];
  const basket: Array<[string, string, number, string?, string?, number?]> = [
    ["svc_braiding", "Braiding", 800_000, "prd_edge", "Edge Control", 130_000],
    ["svc_haircut", "Haircut", 250_000],
    ["svc_install", "Sew-in install", 2_500_000, "prd_closure", "Closure", 1_500_000],
    ["svc_wash", "Wash & blow-dry", 300_000, "prd_shampoo", "Shampoo", 320_000],
    ["svc_manicure", "Gel Manicure", 400_000, "prd_gelpolish", "Gel Nail Polish", 180_000],
    ["svc_style", "Silk press", 600_000],
    ["svc_makeup", "Bridal makeup", 1_500_000, "prd_foundation", "Foundation", 450_000],
    ["svc_pedicure", "Pedicure", 450_000, "prd_nailart", "Nail art", 150_000],
    ["svc_kids", "Kids braiding", 350_000],
  ];

  const rows: Array<[number, number, number, string, string, string, number, string?, string?, number?]> = [];
  /**
   * Ninety days at a realistically busy pace: three or four clients a trading
   * day for a three-chair salon, closed Sundays.
   *
   * The pace is the point. Fifteen sales a month against this salon's real
   * costs (₦150,000 rent, two stylists on wages) described a business losing
   * ₦337,000 a month, which made the demo's analytics read "at risk" — a bad
   * advertisement for a screen whose entire argument is that the numbers are
   * worth looking at. Ninety days also gives the monthly profit-and-loss
   * something to show in every month rather than two empty columns.
   */
  let index = 0;
  for (let daysAgo = 1; daysAgo <= 90 && rows.length < 250; daysAgo += 1) {
    // Closed on Sundays, and the weekend is the busy stretch — read from the
    // real date, so "busiest day" in the analytics is actually true rather
    // than an artefact of a synthetic calendar.
    const weekday = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000).getDay();
    if (weekday === 0) continue;
    // Busier at the weekend, steadier midweek.
    const count = weekday === 6 ? 4 : weekday === 5 ? 3 : index % 2 === 0 ? 3 : 2;
    for (let n = 0; n < count && rows.length < 250; n += 1) {
      const client = clients[(index + n) % clients.length];
      const item = basket[(index * 2 + n) % basket.length];
      const hour = 9 + ((index + n) % 8);
      const minute = (index % 2) * 30;
      rows.push([daysAgo, hour, minute, client, item[0], item[1], item[2], item[3], item[4], item[5]]);
      index += 1;
    }
  }
  return rows;
}


export function demoSales(now = new Date()): Sale[] {
  return [
    // Today
    { id: "sl_1", organizationId: ORG_ID, customerId: "cus_faith", subtotalKobo: 250_000, discountKobo: 0, totalKobo: 250_000, paymentMethod: "cash", paymentStatus: "paid", amountPaidKobo: 250_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 0, 8, 55) },
    { id: "sl_2", organizationId: ORG_ID, customerId: "cus_preye", subtotalKobo: 930_000, discountKobo: 0, totalKobo: 930_000, paymentMethod: "transfer", paymentStatus: "paid", amountPaidKobo: 930_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 0, 11, 5) },
    { id: "sl_3", organizationId: ORG_ID, customerId: "cus_ruth", subtotalKobo: 580_000, discountKobo: 0, totalKobo: 580_000, paymentMethod: "pos", paymentStatus: "paid", amountPaidKobo: 580_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 0, 10, 15) },
    { id: "sl_4", organizationId: ORG_ID, customerId: "cus_comfort", subtotalKobo: 750_000, discountKobo: 0, totalKobo: 750_000, paymentMethod: "cash", paymentStatus: "paid", amountPaidKobo: 750_000, receiptPhotoUrl: null, notes: "Mother and daughter.", createdAt: at(now, 0, 11, 30) },
    { id: "sl_5", organizationId: ORG_ID, customerId: "cus_grace", subtotalKobo: 450_000, discountKobo: 0, totalKobo: 450_000, paymentMethod: "transfer", paymentStatus: "paid", amountPaidKobo: 450_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 0, 11, 45) },
    { id: "sl_6", organizationId: ORG_ID, customerId: "cus_ebiere", subtotalKobo: 570_000, discountKobo: 0, totalKobo: 570_000, paymentMethod: "pos", paymentStatus: "paid", amountPaidKobo: 570_000, receiptPhotoUrl: null, notes: "Walk-in, products only.", createdAt: at(now, 0, 13, 40) },
    { id: "sl_7", organizationId: ORG_ID, customerId: "cus_doris", subtotalKobo: 300_000, discountKobo: 30_000, totalKobo: 270_000, paymentMethod: "cash", paymentStatus: "paid", amountPaidKobo: 270_000, receiptPhotoUrl: null, notes: "Loyalty discount.", createdAt: at(now, 0, 12, 10) },

    // Prior days — for reports and recent activity
    { id: "sl_8", organizationId: ORG_ID, customerId: "cus_miebi", subtotalKobo: 250_000, discountKobo: 0, totalKobo: 250_000, paymentMethod: "cash", paymentStatus: "paid", amountPaidKobo: 250_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 1, 9, 30) },
    { id: "sl_9", organizationId: ORG_ID, customerId: "cus_blessing", subtotalKobo: 800_000, discountKobo: 0, totalKobo: 800_000, paymentMethod: "transfer", paymentStatus: "paid", amountPaidKobo: 800_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 1, 14, 0) },
    { id: "sl_10", organizationId: ORG_ID, customerId: "cus_ivie", subtotalKobo: 2_500_000, discountKobo: 100_000, totalKobo: 2_400_000, paymentMethod: "transfer", paymentStatus: "paid", amountPaidKobo: 2_400_000, receiptPhotoUrl: null, notes: "Full sew-in install.", createdAt: at(now, 3, 12, 0) },
    { id: "sl_11", organizationId: ORG_ID, customerId: "cus_joy", subtotalKobo: 300_000, discountKobo: 0, totalKobo: 300_000, paymentMethod: "cash", paymentStatus: "paid", amountPaidKobo: 300_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 4, 10, 45) },
    { id: "sl_12", organizationId: ORG_ID, customerId: "cus_patience", subtotalKobo: 450_000, discountKobo: 0, totalKobo: 450_000, paymentMethod: "pos", paymentStatus: "paid", amountPaidKobo: 450_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 5, 16, 0) },
    { id: "sl_13", organizationId: ORG_ID, customerId: "cus_chidinma", subtotalKobo: 600_000, discountKobo: 0, totalKobo: 600_000, paymentMethod: "cash", paymentStatus: "partial", amountPaidKobo: 400_000, receiptPhotoUrl: null, notes: "Balance of ₦2,000 outstanding.", createdAt: at(now, 6, 13, 20) },
    { id: "sl_14", organizationId: ORG_ID, customerId: "cus_naomi", subtotalKobo: 180_000, discountKobo: 0, totalKobo: 180_000, paymentMethod: "transfer", paymentStatus: "paid", amountPaidKobo: 180_000, receiptPhotoUrl: null, notes: "", createdAt: at(now, 9, 11, 0) },
    { id: "sl_15", organizationId: ORG_ID, customerId: null, subtotalKobo: 130_000, discountKobo: 0, totalKobo: 130_000, paymentMethod: "cash", paymentStatus: "paid", amountPaidKobo: 130_000, receiptPhotoUrl: null, notes: "Walk-in, no account.", createdAt: at(now, 12, 15, 30) },

    // Trading history — see tradingRecipe(). These are what give the analytics
    // and reports something honest to chart.
    ...tradingRecipe(now).map((row, i): Sale => {
      const [daysAgo, hour, minute, customerId, , , serviceKobo, , , productKobo] = row;
      const subtotal = serviceKobo + (productKobo ?? 0);
      const method: Sale["paymentMethod"] = i % 3 === 0 ? "transfer" : i % 3 === 1 ? "cash" : "pos";
      return {
        id: `sl_g${i}`,
        organizationId: ORG_ID,
        customerId,
        subtotalKobo: subtotal,
        discountKobo: 0,
        totalKobo: subtotal,
        paymentMethod: method,
        paymentStatus: "paid",
        amountPaidKobo: subtotal,
        receiptPhotoUrl: null,
        notes: "",
        createdAt: at(now, daysAgo, hour, minute),
      };
    }),
  ];
}

export function demoSaleItems(now = new Date()): SaleItem[] {
  // One entry per generated sale (plus one more when the basket included a
  // product), derived from the same recipe as the sales themselves.
  const generated: SaleItem[] = [];
  tradingRecipe(now).forEach((row, i) => {
    const [, , , , serviceRef, serviceName, serviceKobo, productRef, productName, productKobo] = row;
    generated.push({
      id: `si_g${i}a`,
      organizationId: ORG_ID,
      saleId: `sl_g${i}`,
      kind: "service",
      refId: serviceRef,
      name: serviceName,
      quantity: 1,
      unitPriceKobo: serviceKobo,
      totalKobo: serviceKobo,
    });
    if (productRef && productName && productKobo) {
      generated.push({
        id: `si_g${i}b`,
        organizationId: ORG_ID,
        saleId: `sl_g${i}`,
        kind: "product",
        refId: productRef,
        name: productName,
        quantity: 1,
        unitPriceKobo: productKobo,
        totalKobo: productKobo,
      });
    }
  });

  return [
    { id: "si_1a", organizationId: ORG_ID, saleId: "sl_1", kind: "service", refId: "svc_haircut", name: "Haircut", quantity: 1, unitPriceKobo: 250_000, totalKobo: 250_000 },

    { id: "si_2a", organizationId: ORG_ID, saleId: "sl_2", kind: "service", refId: "svc_braiding", name: "Braiding", quantity: 1, unitPriceKobo: 800_000, totalKobo: 800_000 },
    { id: "si_2b", organizationId: ORG_ID, saleId: "sl_2", kind: "product", refId: "prd_edge", name: "Edge Control", quantity: 1, unitPriceKobo: 130_000, totalKobo: 130_000 },

    { id: "si_3a", organizationId: ORG_ID, saleId: "sl_3", kind: "service", refId: "svc_manicure", name: "Gel Manicure", quantity: 1, unitPriceKobo: 400_000, totalKobo: 400_000 },
    { id: "si_3b", organizationId: ORG_ID, saleId: "sl_3", kind: "product", refId: "prd_gelpolish", name: "Gel Nail Polish", quantity: 1, unitPriceKobo: 180_000, totalKobo: 180_000 },

    { id: "si_4a", organizationId: ORG_ID, saleId: "sl_4", kind: "service", refId: "svc_kids", name: "Kids Braiding", quantity: 1, unitPriceKobo: 500_000, totalKobo: 500_000 },
    { id: "si_4b", organizationId: ORG_ID, saleId: "sl_4", kind: "service", refId: "svc_haircut", name: "Haircut", quantity: 1, unitPriceKobo: 250_000, totalKobo: 250_000 },

    { id: "si_5a", organizationId: ORG_ID, saleId: "sl_5", kind: "service", refId: "svc_pedicure", name: "Pedicure", quantity: 1, unitPriceKobo: 450_000, totalKobo: 450_000 },

    { id: "si_6a", organizationId: ORG_ID, saleId: "sl_6", kind: "product", refId: "prd_shampoo", name: "Sulfate-Free Shampoo 500ml", quantity: 1, unitPriceKobo: 280_000, totalKobo: 280_000 },
    { id: "si_6b", organizationId: ORG_ID, saleId: "sl_6", kind: "product", refId: "prd_conditioner", name: "Deep Repair Conditioner", quantity: 1, unitPriceKobo: 290_000, totalKobo: 290_000 },

    { id: "si_7a", organizationId: ORG_ID, saleId: "sl_7", kind: "service", refId: "svc_wash", name: "Wash & Blow-dry", quantity: 1, unitPriceKobo: 300_000, totalKobo: 300_000 },
  ];
}

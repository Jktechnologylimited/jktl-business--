"use client";

import { create } from "zustand";
import { buildTenantData } from "@/lib/mock";
import { getIndustry } from "@/lib/industry";
import { id as makeId } from "@/lib/ids";
import { addOutboxEntry, getCachedTenant, outboxCount, putCachedTenant } from "@/lib/offline/idb";
import { onSyncProgress, processOutbox } from "@/lib/offline/sync";
import { signupAction, loginAction, logoutAction, currentSessionAction } from "@/lib/actions/auth-actions";
import { pullAllAction } from "@/lib/actions/sync-actions";
import type {
  BookingStatus,
  BusinessProfile,
  BusinessType,
  Customer,
  Expense,
  Infrastructure,
  Invoice,
  InvoiceStatus,
  LineKind,
  PaymentMethod,
  PaymentStatus,
  Product,
  Service,
  Testimonial,
  TenantData,
} from "@/lib/types";

const SESSION_KEY = "jktl.session.v1";
type Mode = "demo" | "live";

interface SessionShape {
  authenticated: boolean;
  onboardingComplete: boolean;
  businessType: BusinessType;
  businessName: string;
  avatarUrl: string | null;
  mode: Mode;
  organizationId: string | null;
}

const defaultSession: SessionShape = {
  authenticated: false,
  onboardingComplete: false,
  businessType: "salon",
  businessName: "Glam Hair Studio",
  avatarUrl: null,
  mode: "demo",
  organizationId: null,
};

function readSession(): SessionShape {
  if (typeof window === "undefined") return defaultSession;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return defaultSession;
    return { ...defaultSession, ...JSON.parse(raw) };
  } catch {
    return defaultSession;
  }
}

function writeSession(session: SessionShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage can fail (private mode, quota) — session just won't persist.
  }
}

function newId(mode: Mode, prefix: string): string {
  // Live mode needs real UUIDs (they're Postgres primary keys, and stay
  // stable from optimistic creation through eventual sync — see the
  // db/ layer's ON CONFLICT upserts). Demo mode keeps short mock ids.
  return mode === "live" ? crypto.randomUUID() : makeId(prefix);
}

type ActionOutcome = { ok: true } | { ok: false; error: string };

export interface NewCustomerInput {
  name: string;
  phone: string;
  email: string;
  gender: Customer["gender"];
  notes: string;
}

export interface NewServiceInput {
  name: string;
  category: string;
  priceKobo: number;
  durationMin: number;
  description: string;
  active: boolean;
  imageUrl: string | null;
}

export interface NewTestimonialInput {
  customerName: string;
  quote: string;
  rating: number | null;
}

export interface NewProductInput {
  name: string;
  sku: string;
  category: string;
  costKobo: number;
  priceKobo: number;
  stockQty: number;
  lowStockThreshold: number;
  supplier: string;
  active: boolean;
  imageUrl: string | null;
}

export interface NewBookingInput {
  customerId: string;
  serviceId: string;
  staffId: string;
  startsAt: string;
  status: BookingStatus;
  notes: string;
  priceKobo: number;
}

export interface NewSaleLineInput {
  kind: LineKind;
  refId: string;
  name: string;
  quantity: number;
  unitPriceKobo: number;
}

export interface NewSaleInput {
  customerId: string | null;
  items: NewSaleLineInput[];
  discountKobo: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Only meaningful (and required from the form) when paymentStatus is "partial". */
  amountPaidKobo?: number;
  receiptPhotoUrl?: string | null;
  notes: string;
}

export interface SalePaymentInput {
  paymentStatus: PaymentStatus;
  amountPaidKobo: number;
  receiptPhotoUrl?: string | null;
}

export interface NewExpenseInput {
  description: string;
  category: Expense["category"];
  amountKobo: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
}

export interface NewInvoiceLineInput {
  description: string;
  quantity: number;
  unitPriceKobo: number;
}

export interface NewInvoiceInput {
  customerId: string;
  items: NewInvoiceLineInput[];
  discountKobo: number;
  dueDate: string;
  notes: string;
  status: InvoiceStatus;
}

export interface NewMemberInput {
  name: string;
  email: string;
  role: "manager" | "staff";
  title: string;
}

export interface AccountPatch {
  name: string;
  email: string;
  phone: string;
}

export interface BusinessProfilePatch {
  displayName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
}

interface PendingSignup {
  name: string;
  email: string;
  password: string;
  businessName: string;
}

interface BusinessStore {
  hydrated: boolean;
  authenticated: boolean;
  onboardingComplete: boolean;
  online: boolean;
  mode: Mode;
  pendingSyncCount: number;
  data: TenantData;
  pendingSignup: PendingSignup | null;

  hydrate: () => void;
  setOnline: (online: boolean) => void;

  login: (email: string, password: string) => Promise<ActionOutcome>;
  openDemo: () => void;
  /** Stashes signup details; the real account isn't created until business
   * type is chosen in onboarding (createLiveAccount), since the backend
   * needs it up front to create the org + profile in one shot. */
  startSignup: (name: string, email: string, password: string, businessName: string) => void;
  createLiveAccount: (businessType: BusinessType) => Promise<ActionOutcome>;
  completeOnboarding: (type: BusinessType, displayName: string) => void;
  logout: () => Promise<void>;

  addCustomer: (input: NewCustomerInput) => Customer;
  updateCustomer: (id: string, patch: Partial<NewCustomerInput>) => void;
  deleteCustomer: (id: string) => void;

  addService: (input: NewServiceInput) => Service;
  updateService: (id: string, patch: Partial<NewServiceInput>) => void;
  deleteService: (id: string) => void;

  addProduct: (input: NewProductInput) => Product;
  updateProduct: (id: string, patch: Partial<NewProductInput>) => void;
  deleteProduct: (id: string) => void;

  addTestimonial: (input: NewTestimonialInput) => Testimonial;
  updateTestimonial: (id: string, patch: Partial<NewTestimonialInput>) => void;
  deleteTestimonial: (id: string) => void;

  addBooking: (input: NewBookingInput) => void;
  updateBooking: (id: string, patch: Partial<NewBookingInput>) => void;
  deleteBooking: (id: string) => void;

  addSale: (input: NewSaleInput) => void;
  updateSalePayment: (id: string, patch: SalePaymentInput) => void;

  addExpense: (input: NewExpenseInput) => void;
  deleteExpense: (id: string) => void;

  addInvoice: (input: NewInvoiceInput) => Invoice;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  deleteInvoice: (id: string) => void;

  adjustStock: (productId: string, delta: number, reason: string) => void;

  addMember: (input: NewMemberInput) => void;
  removeMember: (id: string) => void;
  updateAccount: (patch: AccountPatch) => void;
  setAvatar: (dataUrl: string | null) => void;
  updateBusinessProfile: (patch: BusinessProfilePatch) => void;
  /** Replaces the whole business profile — used by the website-settings page
   * after a direct (non-outbox) save, since that flow already has the
   * canonical result (from the server in live mode, or constructed locally
   * in demo mode) rather than a partial patch to merge and re-queue. */
  setWebsiteProfile: (profile: BusinessProfile) => void;
  /** Replaces the infrastructure/billing record — used by the Settings
   * "Plan" tab right after a checkout is confirmed, so the new
   * subscription status shows up immediately without a full re-sync. */
  setInfrastructure: (infra: Infrastructure) => void;

  /** Internal: queues a mutation for sync and kicks off processing. No-op in demo mode. */
  enqueueSync: (type: string, payload: unknown) => void;
  /** Internal: writes the current tenant snapshot to IndexedDB. No-op in demo mode. */
  persistCache: () => void;
}

function computeLineTotals(items: { quantity: number; unitPriceKobo: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPriceKobo, 0);
}

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  hydrated: false,
  authenticated: false,
  onboardingComplete: false,
  online: true,
  mode: "demo",
  pendingSyncCount: 0,
  data: buildTenantData(),
  pendingSignup: null,

  hydrate: () => {
    if (get().hydrated) return;
    const session = readSession();
    set((state) => ({
      hydrated: true,
      authenticated: session.authenticated,
      onboardingComplete: session.onboardingComplete,
      mode: session.mode,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      data: {
        ...state.data,
        user: { ...state.data.user, avatarUrl: session.avatarUrl },
        profile: {
          ...state.data.profile,
          businessType: session.businessType,
          displayName: session.businessName,
        },
      },
    }));

    onSyncProgress((count) => set({ pendingSyncCount: count }));
    outboxCount().then((count) => set({ pendingSyncCount: count }));

    if (session.mode === "live" && session.authenticated && session.organizationId) {
      void hydrateLiveData(session.organizationId, set, get);
    }
  },

  setOnline: (online) => {
    set({ online });
    if (online && get().mode === "live") {
      processOutbox().then(() => {
        if (get().pendingSyncCount === 0) void refreshFromServer(set);
      });
    }
  },

  login: async (email, password) => {
    const result = await loginAction(email, password);
    if (!result.ok) return { ok: false, error: result.error };
    const existing = readSession();
    const session: SessionShape = { ...existing, authenticated: true, onboardingComplete: true, mode: "live", organizationId: result.data.organizationId };
    writeSession(session);
    set({ authenticated: true, onboardingComplete: true, mode: "live" });
    await hydrateLiveData(result.data.organizationId, set, get);
    return { ok: true };
  },

  openDemo: () => {
    const existing = readSession();
    const session: SessionShape = { ...defaultSession, authenticated: true, onboardingComplete: true, avatarUrl: existing.avatarUrl, mode: "demo" };
    writeSession(session);
    set((state) => ({ authenticated: true, onboardingComplete: true, mode: "demo", data: { ...state.data, user: { ...state.data.user, avatarUrl: existing.avatarUrl } } }));
  },

  startSignup: (name, email, password, businessName) => {
    const fresh = buildTenantData();
    set(() => ({
      pendingSignup: { name, email, password, businessName },
      authenticated: false,
      onboardingComplete: false,
      mode: "demo",
      data: {
        ...fresh,
        user: { ...fresh.user, name: name || fresh.user.name, avatarUrl: null },
        profile: { ...fresh.profile, displayName: businessName || fresh.profile.displayName },
      },
    }));
  },

  createLiveAccount: async (businessType) => {
    const pending = get().pendingSignup;
    if (!pending) return { ok: false, error: "Missing signup details — please start again." };
    const result = await signupAction({ ...pending, businessType });
    if (!result.ok) return { ok: false, error: result.error };

    const session: SessionShape = {
      ...defaultSession,
      authenticated: true,
      onboardingComplete: false,
      mode: "live",
      organizationId: result.data.organizationId,
      businessType,
      businessName: pending.businessName,
    };
    writeSession(session);
    set({ authenticated: true, onboardingComplete: false, mode: "live", pendingSignup: null });
    await hydrateLiveData(result.data.organizationId, set, get);
    return { ok: true };
  },

  completeOnboarding: (type, displayName) => {
    const session = readSession();
    const next: SessionShape = { ...session, authenticated: true, onboardingComplete: true, businessType: type, businessName: displayName };
    writeSession(next);
    set((state) => ({
      authenticated: true,
      onboardingComplete: true,
      data: { ...state.data, profile: { ...state.data.profile, businessType: type, displayName } },
    }));
    const profile = get().data.profile;
    get().enqueueSync("business.updateProfile", {
      patch: { displayName, phone: profile.phone, email: profile.email, address: profile.address, city: profile.city, state: profile.state },
    });
    get().persistCache();
  },

  logout: async () => {
    const mode = get().mode;
    writeSession(defaultSession);
    set({ authenticated: false, onboardingComplete: false, mode: "demo" });
    if (mode === "live") await logoutAction();
  },

  // ---- Customers ----
  addCustomer: (input) => {
    const mode = get().mode;
    const customer: Customer = { id: newId(mode, "cus"), organizationId: get().data.organization.id, createdAt: new Date().toISOString(), ...input };
    set((state) => ({ data: { ...state.data, customers: [customer, ...state.data.customers] } }));
    get().enqueueSync("customer.create", { id: customer.id, input });
    get().persistCache();
    return customer;
  },
  updateCustomer: (id, patch) => {
    set((state) => ({ data: { ...state.data, customers: state.data.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) } }));
    const full = get().data.customers.find((c) => c.id === id);
    if (full) get().enqueueSync("customer.update", { id, input: { name: full.name, phone: full.phone, email: full.email, gender: full.gender, notes: full.notes } });
    get().persistCache();
  },
  deleteCustomer: (id) => {
    set((state) => ({ data: { ...state.data, customers: state.data.customers.filter((c) => c.id !== id) } }));
    get().enqueueSync("customer.delete", { id });
    get().persistCache();
  },

  // ---- Services ----
  addService: (input) => {
    const mode = get().mode;
    const service: Service = { id: newId(mode, "svc"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, services: [service, ...state.data.services] } }));
    get().enqueueSync("service.create", { id: service.id, input });
    get().persistCache();
    return service;
  },
  updateService: (id, patch) => {
    set((state) => ({ data: { ...state.data, services: state.data.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) } }));
    const full = get().data.services.find((s) => s.id === id);
    if (full) {
      get().enqueueSync("service.update", {
        id,
        input: { name: full.name, category: full.category, priceKobo: full.priceKobo, durationMin: full.durationMin, description: full.description, active: full.active, imageUrl: full.imageUrl },
      });
    }
    get().persistCache();
  },
  deleteService: (id) => {
    set((state) => ({ data: { ...state.data, services: state.data.services.filter((s) => s.id !== id) } }));
    get().enqueueSync("service.delete", { id });
    get().persistCache();
  },

  // ---- Products ----
  addProduct: (input) => {
    const mode = get().mode;
    const product: Product = { id: newId(mode, "prd"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, products: [product, ...state.data.products] } }));
    get().enqueueSync("product.create", { id: product.id, input });
    get().persistCache();
    return product;
  },
  updateProduct: (id, patch) => {
    set((state) => ({ data: { ...state.data, products: state.data.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) } }));
    const full = get().data.products.find((p) => p.id === id);
    if (full) {
      get().enqueueSync("product.update", {
        id,
        input: { name: full.name, sku: full.sku, category: full.category, costKobo: full.costKobo, priceKobo: full.priceKobo, stockQty: full.stockQty, lowStockThreshold: full.lowStockThreshold, supplier: full.supplier, active: full.active, imageUrl: full.imageUrl },
      });
    }
    get().persistCache();
  },
  deleteProduct: (id) => {
    set((state) => ({ data: { ...state.data, products: state.data.products.filter((p) => p.id !== id) } }));
    get().enqueueSync("product.delete", { id });
    get().persistCache();
  },

  // ---- Testimonials ----
  addTestimonial: (input) => {
    const mode = get().mode;
    const testimonial: Testimonial = { id: newId(mode, "tst"), organizationId: get().data.organization.id, createdAt: new Date().toISOString(), ...input };
    set((state) => ({ data: { ...state.data, testimonials: [testimonial, ...state.data.testimonials] } }));
    get().enqueueSync("testimonial.create", { id: testimonial.id, input });
    get().persistCache();
    return testimonial;
  },
  updateTestimonial: (id, patch) => {
    set((state) => ({ data: { ...state.data, testimonials: state.data.testimonials.map((t) => (t.id === id ? { ...t, ...patch } : t)) } }));
    const full = get().data.testimonials.find((t) => t.id === id);
    if (full) get().enqueueSync("testimonial.update", { id, input: { customerName: full.customerName, quote: full.quote, rating: full.rating } });
    get().persistCache();
  },
  deleteTestimonial: (id) => {
    set((state) => ({ data: { ...state.data, testimonials: state.data.testimonials.filter((t) => t.id !== id) } }));
    get().enqueueSync("testimonial.delete", { id });
    get().persistCache();
  },

  // ---- Bookings ----
  addBooking: (input) => {
    const mode = get().mode;
    const booking = { id: newId(mode, "bk"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, bookings: [booking, ...state.data.bookings] } }));
    get().enqueueSync("booking.create", { id: booking.id, input });
    get().persistCache();
  },
  updateBooking: (id, patch) => {
    set((state) => ({ data: { ...state.data, bookings: state.data.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) } }));
    const full = get().data.bookings.find((b) => b.id === id);
    if (full) {
      if (Object.keys(patch).length === 1 && "status" in patch) {
        get().enqueueSync("booking.updateStatus", { id, status: full.status });
      } else {
        get().enqueueSync("booking.update", { id, input: { customerId: full.customerId, serviceId: full.serviceId, staffId: full.staffId, startsAt: full.startsAt, status: full.status, notes: full.notes, priceKobo: full.priceKobo } });
      }
    }
    get().persistCache();
  },
  deleteBooking: (id) => {
    set((state) => ({ data: { ...state.data, bookings: state.data.bookings.filter((b) => b.id !== id) } }));
    get().enqueueSync("booking.delete", { id });
    get().persistCache();
  },

  // ---- Sales (also deducts stock + logs movements for product lines) ----
  addSale: (input) => {
    const mode = get().mode;
    const orgId = get().data.organization.id;
    const subtotalKobo = computeLineTotals(input.items);
    const totalKobo = Math.max(0, subtotalKobo - input.discountKobo);
    const amountPaidKobo =
      input.paymentStatus === "paid" ? totalKobo : input.paymentStatus === "pending" ? 0 : Math.min(totalKobo, Math.max(0, input.amountPaidKobo ?? 0));
    const saleId = newId(mode, "sl");
    const createdAt = new Date().toISOString();
    const sale = {
      id: saleId,
      organizationId: orgId,
      customerId: input.customerId,
      subtotalKobo,
      discountKobo: input.discountKobo,
      totalKobo,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      amountPaidKobo,
      receiptPhotoUrl: input.receiptPhotoUrl ?? null,
      notes: input.notes,
      createdAt,
    };
    const saleItems = input.items.map((line) => ({
      id: newId(mode, "si"),
      organizationId: orgId,
      saleId,
      kind: line.kind,
      refId: line.refId,
      name: line.name,
      quantity: line.quantity,
      unitPriceKobo: line.unitPriceKobo,
      totalKobo: line.quantity * line.unitPriceKobo,
    }));

    set((state) => {
      let products = state.data.products;
      const movements = [...state.data.movements];
      for (const line of saleItems) {
        if (line.kind !== "product") continue;
        products = products.map((p) => (p.id === line.refId ? { ...p, stockQty: p.stockQty - line.quantity } : p));
        movements.unshift({ id: newId(mode, "mv"), organizationId: orgId, productId: line.refId, type: "sale", quantity: -line.quantity, reason: `Sold in sale ${saleId}`, createdAt });
      }
      return { data: { ...state.data, sales: [sale, ...state.data.sales], saleItems: [...saleItems, ...state.data.saleItems], products, movements } };
    });

    get().enqueueSync("sale.create", {
      input: {
        id: saleId,
        customerId: input.customerId,
        items: saleItems.map((i) => ({ id: i.id, kind: i.kind, refId: i.refId, name: i.name, quantity: i.quantity, unitPriceKobo: i.unitPriceKobo })),
        discountKobo: input.discountKobo,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentStatus,
        amountPaidKobo,
        receiptPhotoUrl: sale.receiptPhotoUrl,
        notes: input.notes,
      },
    });
    get().persistCache();
  },
  updateSalePayment: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        sales: state.data.sales.map((s) =>
          s.id === id
            ? { ...s, paymentStatus: patch.paymentStatus, amountPaidKobo: patch.amountPaidKobo, receiptPhotoUrl: patch.receiptPhotoUrl !== undefined ? patch.receiptPhotoUrl : s.receiptPhotoUrl }
            : s,
        ),
      },
    }));
    get().enqueueSync("sale.updatePayment", { id, patch });
    get().persistCache();
  },

  // ---- Expenses ----
  addExpense: (input) => {
    const mode = get().mode;
    const expense: Expense = { id: newId(mode, "ex"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, expenses: [expense, ...state.data.expenses] } }));
    get().enqueueSync("expense.create", { id: expense.id, input });
    get().persistCache();
  },
  deleteExpense: (id) => {
    set((state) => ({ data: { ...state.data, expenses: state.data.expenses.filter((e) => e.id !== id) } }));
    get().enqueueSync("expense.delete", { id });
    get().persistCache();
  },

  // ---- Invoices ----
  addInvoice: (input) => {
    const mode = get().mode;
    const orgId = get().data.organization.id;
    const nextNumber = get().data.invoices.length + 1;
    const subtotalKobo = computeLineTotals(input.items);
    const totalKobo = Math.max(0, subtotalKobo - input.discountKobo);
    const invoiceId = newId(mode, "inv");
    const number = `INV-${String(nextNumber).padStart(4, "0")}`;
    const invoice: Invoice = {
      id: invoiceId,
      organizationId: orgId,
      number,
      customerId: input.customerId,
      status: input.status,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: input.dueDate,
      subtotalKobo,
      discountKobo: input.discountKobo,
      totalKobo,
      notes: input.notes,
      paidAt: input.status === "paid" ? new Date().toISOString() : null,
      paidVia: "manual",
      platformFeeKobo: 0,
      paymentReference: "",
    };
    const items = input.items.map((line) => ({
      id: newId(mode, "ii"),
      organizationId: orgId,
      invoiceId,
      description: line.description,
      quantity: line.quantity,
      unitPriceKobo: line.unitPriceKobo,
      totalKobo: line.quantity * line.unitPriceKobo,
    }));
    set((state) => ({ data: { ...state.data, invoices: [invoice, ...state.data.invoices], invoiceItems: [...items, ...state.data.invoiceItems] } }));
    get().enqueueSync("invoice.create", {
      input: { id: invoiceId, number, customerId: input.customerId, items: items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unitPriceKobo: i.unitPriceKobo })), discountKobo: input.discountKobo, dueDate: input.dueDate, notes: input.notes, status: input.status },
    });
    get().persistCache();
    return invoice;
  },
  updateInvoiceStatus: (id, status) => {
    set((state) => ({
      data: { ...state.data, invoices: state.data.invoices.map((inv) => (inv.id === id ? { ...inv, status, paidAt: status === "paid" ? new Date().toISOString() : inv.paidAt } : inv)) },
    }));
    get().enqueueSync("invoice.updateStatus", { id, status });
    get().persistCache();
  },
  deleteInvoice: (id) => {
    set((state) => ({ data: { ...state.data, invoices: state.data.invoices.filter((i) => i.id !== id) } }));
    get().enqueueSync("invoice.delete", { id });
    get().persistCache();
  },

  // ---- Inventory ----
  adjustStock: (productId, delta, reason) => {
    const mode = get().mode;
    const orgId = get().data.organization.id;
    set((state) => ({
      data: {
        ...state.data,
        products: state.data.products.map((p) => (p.id === productId ? { ...p, stockQty: p.stockQty + delta } : p)),
        movements: [{ id: newId(mode, "mv"), organizationId: orgId, productId, type: delta >= 0 ? "addition" : "adjustment", quantity: delta, reason, createdAt: new Date().toISOString() }, ...state.data.movements],
      },
    }));
    get().enqueueSync("inventory.adjust", { productId, delta, reason });
    get().persistCache();
  },

  // ---- Team members ----
  addMember: (input) => {
    const mode = get().mode;
    const orgId = get().data.organization.id;
    const member = { id: newId(mode, "mem"), organizationId: orgId, userId: newId(mode, "usr"), name: input.name, email: input.email, role: input.role, title: input.title, active: true };
    set((state) => ({ data: { ...state.data, members: [...state.data.members, member] } }));
    get().enqueueSync("member.add", { id: member.id, input });
    get().persistCache();
  },
  removeMember: (id) => {
    set((state) => ({ data: { ...state.data, members: state.data.members.filter((m) => m.id !== id || m.role === "owner") } }));
    get().enqueueSync("member.remove", { id });
    get().persistCache();
  },

  // ---- Account ----
  updateAccount: (patch) => {
    set((state) => ({ data: { ...state.data, user: { ...state.data.user, ...patch } } }));
    get().enqueueSync("account.update", { patch });
    get().persistCache();
  },
  setAvatar: (dataUrl) => {
    const session = readSession();
    writeSession({ ...session, avatarUrl: dataUrl });
    set((state) => ({ data: { ...state.data, user: { ...state.data.user, avatarUrl: dataUrl } } }));
    get().enqueueSync("account.setAvatar", { dataUrl });
    get().persistCache();
  },

  // ---- Business profile ----
  updateBusinessProfile: (patch) => {
    const session = readSession();
    writeSession({ ...session, businessName: patch.displayName });
    set((state) => ({ data: { ...state.data, profile: { ...state.data.profile, ...patch } } }));
    get().enqueueSync("business.updateProfile", { patch });
    get().persistCache();
  },

  setWebsiteProfile: (profile) => {
    set((state) => ({ data: { ...state.data, profile } }));
    get().persistCache();
  },

  setInfrastructure: (infrastructure) => {
    set((state) => ({ data: { ...state.data, infrastructure } }));
    get().persistCache();
  },

  enqueueSync: (type, payload) => {
    if (get().mode !== "live") return;
    void addOutboxEntry(type, payload).then(() => {
      set({ pendingSyncCount: get().pendingSyncCount + 1 });
      void processOutbox();
    });
  },

  persistCache: () => {
    const state = get();
    if (state.mode !== "live") return;
    void putCachedTenant(state.data.organization.id, state.data);
  },
}));

async function hydrateLiveData(
  organizationId: string,
  set: (partial: Partial<BusinessStore>) => void,
  get: () => BusinessStore,
): Promise<void> {
  // Cache first: instant, and works fully offline.
  const cached = await getCachedTenant(organizationId);
  if (cached) set({ data: cached.data as TenantData });

  // Verify the server session is still valid, and refresh from it — but
  // only overwrite local state if nothing is queued that a fresh pull
  // would otherwise clobber (see refreshFromServer).
  if (typeof navigator !== "undefined" && navigator.onLine) {
    const session = await currentSessionAction();
    if (!session.ok) return; // stale local session; leave cache in place, offline banner will show
    await processOutbox();
    if (get().pendingSyncCount === 0) await refreshFromServer(set);
  }
}

async function refreshFromServer(set: (partial: Partial<BusinessStore>) => void): Promise<void> {
  const result = await pullAllAction();
  if (!result.ok) return;
  set({ data: result.data });
  void putCachedTenant(result.data.organization.id, result.data);
}

export function useCurrentIndustry() {
  const businessType = useBusinessStore((s) => s.data.profile.businessType);
  return getIndustry(businessType);
}

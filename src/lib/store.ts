"use client";

import { create } from "zustand";
import { buildTenantData } from "@/lib/mock";
import { getIndustry } from "@/lib/industry";
import { id as makeId } from "@/lib/ids";
import type {
  BookingStatus,
  BusinessType,
  Customer,
  Expense,
  Invoice,
  InvoiceStatus,
  LineKind,
  PaymentMethod,
  PaymentStatus,
  Product,
  Sale,
  Service,
  TenantData,
} from "@/lib/types";

const SESSION_KEY = "jktl.session.v1";
const DEMO_EMAIL = "ada@glamhair.jktl.com.ng";
const DEMO_PASSWORD = "glamhair";

interface SessionShape {
  authenticated: boolean;
  onboardingComplete: boolean;
  businessType: BusinessType;
  businessName: string;
}

const defaultSession: SessionShape = {
  authenticated: false,
  onboardingComplete: false,
  businessType: "salon",
  businessName: "Glam Hair Studio",
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

type LoginResult = { ok: true } | { ok: false; error: string };

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
  notes: string;
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

interface BusinessStore {
  hydrated: boolean;
  authenticated: boolean;
  onboardingComplete: boolean;
  online: boolean;
  data: TenantData;

  hydrate: () => void;
  setOnline: (online: boolean) => void;
  login: (email: string, password: string) => LoginResult;
  openDemo: () => void;
  startSignup: (name: string, businessName: string) => void;
  completeOnboarding: (type: BusinessType, displayName: string) => void;
  logout: () => void;

  addCustomer: (input: NewCustomerInput) => Customer;
  updateCustomer: (id: string, patch: Partial<NewCustomerInput>) => void;
  deleteCustomer: (id: string) => void;

  addService: (input: NewServiceInput) => Service;
  updateService: (id: string, patch: Partial<NewServiceInput>) => void;
  deleteService: (id: string) => void;

  addProduct: (input: NewProductInput) => Product;
  updateProduct: (id: string, patch: Partial<NewProductInput>) => void;
  deleteProduct: (id: string) => void;

  addBooking: (input: NewBookingInput) => void;
  updateBooking: (id: string, patch: Partial<NewBookingInput>) => void;
  deleteBooking: (id: string) => void;

  addSale: (input: NewSaleInput) => Sale;

  addExpense: (input: NewExpenseInput) => void;
  deleteExpense: (id: string) => void;

  addInvoice: (input: NewInvoiceInput) => Invoice;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  deleteInvoice: (id: string) => void;

  adjustStock: (productId: string, delta: number, reason: string) => void;
}

function computeLineTotals(items: { quantity: number; unitPriceKobo: number }[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPriceKobo, 0);
}

export const useBusinessStore = create<BusinessStore>((set, get) => ({
  hydrated: false,
  authenticated: false,
  onboardingComplete: false,
  online: true,
  data: buildTenantData(),

  hydrate: () => {
    if (get().hydrated) return;
    const session = readSession();
    set((state) => ({
      hydrated: true,
      authenticated: session.authenticated,
      onboardingComplete: session.onboardingComplete,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      data: {
        ...state.data,
        profile: {
          ...state.data.profile,
          businessType: session.businessType,
          displayName: session.businessName,
        },
      },
    }));
  },

  setOnline: (online) => set({ online }),

  login: (email, password) => {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      return { ok: false, error: "That email and password don't match a JKTL Business account." };
    }
    const session: SessionShape = { ...defaultSession, authenticated: true, onboardingComplete: true };
    writeSession(session);
    set({ authenticated: true, onboardingComplete: true });
    return { ok: true };
  },

  openDemo: () => {
    const session: SessionShape = { ...defaultSession, authenticated: true, onboardingComplete: true };
    writeSession(session);
    set({ authenticated: true, onboardingComplete: true });
  },

  startSignup: (name, businessName) => {
    const session = readSession();
    const next: SessionShape = { ...session, authenticated: true, onboardingComplete: false, businessName };
    writeSession(next);
    set((state) => ({
      authenticated: true,
      onboardingComplete: false,
      data: {
        ...state.data,
        user: { ...state.data.user, name: name || state.data.user.name },
        profile: { ...state.data.profile, displayName: businessName || state.data.profile.displayName },
      },
    }));
  },

  completeOnboarding: (type, displayName) => {
    const session = readSession();
    const next: SessionShape = { ...session, authenticated: true, onboardingComplete: true, businessType: type, businessName: displayName };
    writeSession(next);
    set((state) => ({
      onboardingComplete: true,
      data: {
        ...state.data,
        profile: { ...state.data.profile, businessType: type, displayName },
      },
    }));
  },

  logout: () => {
    writeSession(defaultSession);
    set({ authenticated: false, onboardingComplete: false });
  },

  // ---- Customers ----
  addCustomer: (input) => {
    const customer: Customer = {
      id: makeId("cus"),
      organizationId: get().data.organization.id,
      createdAt: new Date().toISOString(),
      ...input,
    };
    set((state) => ({ data: { ...state.data, customers: [customer, ...state.data.customers] } }));
    return customer;
  },
  updateCustomer: (id, patch) => {
    set((state) => ({
      data: { ...state.data, customers: state.data.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) },
    }));
  },
  deleteCustomer: (id) => {
    set((state) => ({ data: { ...state.data, customers: state.data.customers.filter((c) => c.id !== id) } }));
  },

  // ---- Services ----
  addService: (input) => {
    const service: Service = { id: makeId("svc"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, services: [service, ...state.data.services] } }));
    return service;
  },
  updateService: (id, patch) => {
    set((state) => ({
      data: { ...state.data, services: state.data.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) },
    }));
  },
  deleteService: (id) => {
    set((state) => ({ data: { ...state.data, services: state.data.services.filter((s) => s.id !== id) } }));
  },

  // ---- Products ----
  addProduct: (input) => {
    const product: Product = { id: makeId("prd"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, products: [product, ...state.data.products] } }));
    return product;
  },
  updateProduct: (id, patch) => {
    set((state) => ({
      data: { ...state.data, products: state.data.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) },
    }));
  },
  deleteProduct: (id) => {
    set((state) => ({ data: { ...state.data, products: state.data.products.filter((p) => p.id !== id) } }));
  },

  // ---- Bookings ----
  addBooking: (input) => {
    const booking = { id: makeId("bk"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, bookings: [booking, ...state.data.bookings] } }));
  },
  updateBooking: (id, patch) => {
    set((state) => ({
      data: { ...state.data, bookings: state.data.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) },
    }));
  },
  deleteBooking: (id) => {
    set((state) => ({ data: { ...state.data, bookings: state.data.bookings.filter((b) => b.id !== id) } }));
  },

  // ---- Sales (also deducts stock + logs movements for product lines) ----
  addSale: (input) => {
    const orgId = get().data.organization.id;
    const subtotalKobo = computeLineTotals(input.items);
    const totalKobo = Math.max(0, subtotalKobo - input.discountKobo);
    const sale: Sale = {
      id: makeId("sl"),
      organizationId: orgId,
      customerId: input.customerId,
      subtotalKobo,
      discountKobo: input.discountKobo,
      totalKobo,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    const saleItems = input.items.map((line) => ({
      id: makeId("si"),
      organizationId: orgId,
      saleId: sale.id,
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
      for (const line of input.items) {
        if (line.kind !== "product") continue;
        products = products.map((p) => (p.id === line.refId ? { ...p, stockQty: p.stockQty - line.quantity } : p));
        movements.unshift({
          id: makeId("mv"),
          organizationId: orgId,
          productId: line.refId,
          type: "sale",
          quantity: -line.quantity,
          reason: `Sold in sale ${sale.id}`,
          createdAt: sale.createdAt,
        });
      }
      return {
        data: {
          ...state.data,
          sales: [sale, ...state.data.sales],
          saleItems: [...saleItems, ...state.data.saleItems],
          products,
          movements,
        },
      };
    });
    return sale;
  },

  // ---- Expenses ----
  addExpense: (input) => {
    const expense: Expense = { id: makeId("ex"), organizationId: get().data.organization.id, ...input };
    set((state) => ({ data: { ...state.data, expenses: [expense, ...state.data.expenses] } }));
  },
  deleteExpense: (id) => {
    set((state) => ({ data: { ...state.data, expenses: state.data.expenses.filter((e) => e.id !== id) } }));
  },

  // ---- Invoices ----
  addInvoice: (input) => {
    const orgId = get().data.organization.id;
    const existing = get().data.invoices;
    const nextNumber = existing.length + 1;
    const subtotalKobo = computeLineTotals(input.items);
    const totalKobo = Math.max(0, subtotalKobo - input.discountKobo);
    const invoice: Invoice = {
      id: makeId("inv"),
      organizationId: orgId,
      number: `INV-${String(nextNumber).padStart(4, "0")}`,
      customerId: input.customerId,
      status: input.status,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: input.dueDate,
      subtotalKobo,
      discountKobo: input.discountKobo,
      totalKobo,
      notes: input.notes,
      paidAt: input.status === "paid" ? new Date().toISOString() : null,
    };
    const items = input.items.map((line) => ({
      id: makeId("ii"),
      organizationId: orgId,
      invoiceId: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unitPriceKobo: line.unitPriceKobo,
      totalKobo: line.quantity * line.unitPriceKobo,
    }));
    set((state) => ({
      data: {
        ...state.data,
        invoices: [invoice, ...state.data.invoices],
        invoiceItems: [...items, ...state.data.invoiceItems],
      },
    }));
    return invoice;
  },
  updateInvoiceStatus: (id, status) => {
    set((state) => ({
      data: {
        ...state.data,
        invoices: state.data.invoices.map((inv) =>
          inv.id === id
            ? { ...inv, status, paidAt: status === "paid" ? new Date().toISOString() : inv.paidAt }
            : inv,
        ),
      },
    }));
  },
  deleteInvoice: (id) => {
    set((state) => ({ data: { ...state.data, invoices: state.data.invoices.filter((i) => i.id !== id) } }));
  },

  // ---- Inventory ----
  adjustStock: (productId, delta, reason) => {
    const orgId = get().data.organization.id;
    set((state) => ({
      data: {
        ...state.data,
        products: state.data.products.map((p) => (p.id === productId ? { ...p, stockQty: p.stockQty + delta } : p)),
        movements: [
          {
            id: makeId("mv"),
            organizationId: orgId,
            productId,
            type: delta >= 0 ? "addition" : "adjustment",
            quantity: delta,
            reason,
            createdAt: new Date().toISOString(),
          },
          ...state.data.movements,
        ],
      },
    }));
  },
}));

export function useCurrentIndustry() {
  const businessType = useBusinessStore((s) => s.data.profile.businessType);
  return getIndustry(businessType);
}

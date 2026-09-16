"use client";

import { create } from "zustand";

interface ToastItem {
  id: string;
  message: string;
  tone: "default" | "danger";
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, tone?: "default" | "danger") => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, tone = "default") => {
    const toastId = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id: toastId, message, tone }] }));
    setTimeout(() => get().dismiss(toastId), 3200);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

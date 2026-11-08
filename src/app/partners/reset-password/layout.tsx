import type { ReactNode } from "react";
import { authPageMetadata } from "@/lib/auth-page";
export const metadata = authPageMetadata(
  "/partners/reset-password",
  "Reset your partner password | JKTL Business",
  "Secure password recovery for JKTL Partners.",
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

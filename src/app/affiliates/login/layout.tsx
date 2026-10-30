import type { ReactNode } from "react";
import { authPageMetadata } from "@/lib/auth-page";
export const metadata = authPageMetadata(
  "/affiliates/login",
  "Affiliate sign in | JKTL Business",
  "Secure account access for JKTL Business.",
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

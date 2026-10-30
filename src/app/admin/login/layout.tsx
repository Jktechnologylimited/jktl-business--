import type { ReactNode } from "react";
import { authPageMetadata } from "@/lib/auth-page";
export const metadata = authPageMetadata(
  "/admin/login",
  "Team sign in | JKTL Business",
  "Secure account access for JKTL Business.",
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}

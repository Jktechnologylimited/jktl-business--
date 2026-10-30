import { authPageMetadata, type AuthQuery } from "@/lib/auth-page";
import LoginClient from "./login-client";
export const metadata = authPageMetadata(
  "/login",
  "Sign in | JKTL Business",
  "Sign in to JKTL Business to manage your website, customers, services and business tools.",
);
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<AuthQuery>;
}) {
  return <LoginClient searchParams={await searchParams} />;
}

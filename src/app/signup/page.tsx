import { authPageMetadata, type AuthQuery } from "@/lib/auth-page";
import SignupClient from "./signup-client";
export const metadata = authPageMetadata(
  "/signup",
  "Create your free account | JKTL Business",
  "Create your free JKTL Business account and continue setting up your selected website template.",
);
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<AuthQuery>;
}) {
  return <SignupClient searchParams={await searchParams} />;
}

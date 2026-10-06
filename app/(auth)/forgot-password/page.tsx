import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password — DocLink CRM",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}

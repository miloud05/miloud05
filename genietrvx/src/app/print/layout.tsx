import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentUser())) redirect("/login");
  return <div className="min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">{children}</div>;
}

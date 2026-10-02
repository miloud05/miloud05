import type { Metadata } from "next";
import { PrintDocument } from "@/components/print/PrintDocument";

export const metadata: Metadata = { title: "Document" };

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ doc: string; id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { doc, id } = await params;
  const { project } = await searchParams;
  return <PrintDocument doc={doc} id={id} projectId={project ?? ""} />;
}

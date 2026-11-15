import type { ReactNode } from "react";
import { Schema } from "@/components/schema";
import { articleStructuredData, type GuideId } from "@/lib/guides";

export async function GuideFrame({
  id,
  children,
}: {
  id: GuideId;
  children: ReactNode;
}) {
  return (
    <main id="main" className="document-page prose">
      <Schema data={articleStructuredData(id)} />
      {children}
    </main>
  );
}

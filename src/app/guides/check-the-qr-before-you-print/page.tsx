import { GuideFrame } from "@/components/guide-frame";
import { PrintCheckArticle } from "@/components/guides/print-check-article";
import { guideMetadata } from "@/lib/guides";

export const metadata = guideMetadata("print");

export default function PrintCheckGuide() {
  return (
    <GuideFrame id="print">
      <PrintCheckArticle />
    </GuideFrame>
  );
}

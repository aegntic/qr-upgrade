import { GuideFrame } from "@/components/guide-frame";
import { DynamicQrArticle } from "@/components/guides/dynamic-qr-article";
import { guideMetadata } from "@/lib/guides";

export const metadata = guideMetadata("dynamic");

export default function DynamicQrGuide() {
  return (
    <GuideFrame id="dynamic">
      <DynamicQrArticle />
    </GuideFrame>
  );
}

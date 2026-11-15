import { GuideFrame } from "@/components/guide-frame";
import { FreeStudioArticle } from "@/components/guides/free-studio-article";
import { guideMetadata } from "@/lib/guides";

export const metadata = guideMetadata("compare");

export default function FreeStudioGuide() {
  return (
    <GuideFrame id="compare">
      <FreeStudioArticle />
    </GuideFrame>
  );
}

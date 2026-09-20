import {
  Globe,
  Camera,
  Star,
  Wifi,
  FileText,
  Music2,
  BriefcaseBusiness,
  Ghost,
  Video,
  Disc3,
  MessageCircle,
  Users,
  ShoppingBag,
  MapPin,
  ContactRound,
  Utensils,
  ClipboardList,
} from "lucide-react";
import type { DestinationId } from "@/lib/generator-options";
const icons = {
  website: Globe,
  instagram: Camera,
  reviews: Star,
  wifi: Wifi,
  pdf: FileText,
  tiktok: Music2,
  linkedin: BriefcaseBusiness,
  snapchat: Ghost,
  youtube: Video,
  spotify: Disc3,
  whatsapp: MessageCircle,
  facebook: Users,
  amazon: ShoppingBag,
  maps: MapPin,
  vcard: ContactRound,
  menu: Utensils,
  forms: ClipboardList,
};
const glassIcons = new Set<DestinationId>([
  "instagram",
  "tiktok",
  "linkedin",
  "snapchat",
  "youtube",
  "whatsapp",
  "facebook",
]);
export function DestinationIcon({
  id,
  size = 19,
}: {
  id: DestinationId;
  size?: number;
}) {
  if (glassIcons.has(id))
    return (
      <img
        className="destination-glass-icon"
        src={`/destination-icons/${id}.webp`}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    );
  if (id === "x")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M5 4h4l10 16h-4L5 4Zm14 0L5 20" />
      </svg>
    );
  const Icon = icons[id];
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

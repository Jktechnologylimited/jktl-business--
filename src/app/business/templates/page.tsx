import Link from "next/link";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
export default function BusinessTemplatesPage() {
  return (
    <div>
      <Link
        href="/business/website"
        className="block mb-5 text-sm text-primary"
      >
        ← Website settings
      </Link>
      <TemplateGallery insideBusiness />
    </div>
  );
}

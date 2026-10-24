import { T } from "@/components/i18n/LanguageProvider";
import Link from "next/link";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
export default function BusinessTemplatesPage() {
  return (
    <div>
      <Link
        href="/business/website"
        className="block mb-5 text-sm text-primary"
      >
        <T>← Website settings</T>
      </Link>
      <TemplateGallery insideBusiness />
    </div>
  );
}

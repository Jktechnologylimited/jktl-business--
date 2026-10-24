import { LanguageSwitcher } from "@/components/i18n/LanguageProvider";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
export default function PublicTemplatesPage() {
  return (
    <>
      <div className="p-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <TemplateGallery />
    </>
  );
}

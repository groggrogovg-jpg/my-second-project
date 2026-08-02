import { Shield } from "lucide-react";
import { LegalDocumentPage } from "@/components/legal-document-page";
import { privacyPolicySections } from "@/data/legal-documents";

export default function PrivacyPolicy() {
  return (
    <LegalDocumentPage
      title="Политика конфиденциальности"
      icon={Shield}
      sections={privacyPolicySections}
    />
  );
}
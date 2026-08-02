import { FileText } from "lucide-react";
import { LegalDocumentPage } from "@/components/legal-document-page";
import {
  subscriptionAgreementDetails,
  subscriptionAgreementSections,
} from "@/data/legal-documents";

export default function SubscriptionAgreement() {
  return (
    <LegalDocumentPage
      title="Соглашение о подписке и использовании сервиса «КардоМатик»"
      icon={FileText}
      sections={subscriptionAgreementSections}
      details={subscriptionAgreementDetails}
    />
  );
}
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { ComponentType } from "react";
import type { LegalSection } from "@/data/legal-documents";
import { Header } from "@/components/header";

interface LegalDocumentPageProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  sections: LegalSection[];
  details?: string;
}

export function LegalDocumentPage({
  title,
  icon: Icon,
  sections,
  details,
}: LegalDocumentPageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        showBack
        backHref="/"
        desktopRight={
          <Link href="/app">
            <span className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Попробовать
            </span>
          </Link>
        }
      />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
          <div className="mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-4">
              <Icon className="w-3.5 h-3.5" />
              Правовые документы
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Действует для сайта{" "}
              <a
                href="https://kardomatik.ru"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://kardomatik.ru
              </a>
            </p>
          </div>

          <div className="prose prose-sm sm:prose-base prose-slate dark:prose-invert max-w-none text-foreground">
            {sections.map((section) => (
              <section key={section.title} className="mb-8 sm:mb-10">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3">
                  {section.title}
                </h2>
                <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {section.content.split(/\n\n+/).map((paragraph, index) => (
                    <p key={`${section.title}-${index}`} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {details && (
              <section className="mb-8 sm:mb-10">
                <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3">
                  Реквизиты Администрации
                </h2>
                <p className="whitespace-pre-line text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {details}
                </p>
              </section>
            )}
          </div>

          <div className="mt-10 pt-6 border-t border-border">
            <Link href="/">
              <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Вернуться на главную
              </button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>© 2025 КардоМатик</div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Тарифы</Link>
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Политика конфиденциальности</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
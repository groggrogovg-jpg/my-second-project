import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Check, ArrowLeft, Zap, Crown, Package, Loader2 } from "lucide-react";
import { NANO2_PACKAGES, PRO_PACKAGES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type ModelTab = "nano2" | "pro";

export default function Pricing() {
  const [tab, setTab] = useState<ModelTab>("pro");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Назад</span>
            </button>
          </Link>
          <div className="flex items-center gap-2 ml-1 sm:ml-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm sm:text-base text-foreground">КардоМатик</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-3 sm:mb-4">
            <Zap className="w-3 h-3" />
            Пакеты карточек
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3 tracking-tight">
            Выберите пакет
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-3 sm:mb-4 px-1">
            Покупайте карточки пакетами — чем больше, тем дешевле. Без подписок, без автосписаний.
          </p>
          <div className="inline-flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">5 карточек бесплатно при регистрации</span>
            <Badge variant="secondary" className="text-xs">Пробный режим</Badge>
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
            <button
              data-testid="tab-nano2"
              onClick={() => setTab("nano2")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === "nano2"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Nano Banana 2
              <span className="text-xs text-muted-foreground font-normal">от 35 ₽/шт</span>
            </button>
            <button
              data-testid="tab-pro"
              onClick={() => setTab("pro")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === "pro"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              Nano Banana Pro
              <span className="text-xs text-muted-foreground font-normal">от 55 ₽/шт</span>
            </button>
          </div>
        </div>

        {tab === "nano2" && <PackagesGrid model="nano2" packages={NANO2_PACKAGES} />}
        {tab === "pro" && <PackagesGrid model="pro" packages={PRO_PACKAGES} />}

        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Package className="w-8 h-8 text-primary flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1">Что включено в каждый пакет</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                {[
                  "Анализ товара GPT-4o",
                  "Продающий заголовок и описание",
                  "Профессиональный дизайн карточки",
                  "Скачивание PNG без водяных знаков",
                  "Маркетинговый анализ",
                  "Карточки не сгорают",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Оплата будет доступна в ближайшее время. По вопросам:{" "}
            <a href="mailto:hello@kardomatik.ru" className="text-primary hover:underline">
              hello@kardomatik.ru
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function PackagesGrid({
  model,
  packages,
}: {
  model: "nano2" | "pro";
  packages: readonly { id: string; cards: number; price: number; perCard: number; saving: number; popular: boolean }[];
}) {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePay = async (packageId: string) => {
    setLoadingId(packageId);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Ошибка при создании платежа");
      }
      window.location.href = data.url;
    } catch (err: any) {
      toast({
        title: "Ошибка оплаты",
        description: err.message || "Не удалось создать платёж. Попробуйте позже.",
        variant: "destructive",
      });
      setLoadingId(null);
    }
  };

  const modelName = model === "nano2" ? "Nano Banana 2" : "Nano Banana Pro";
  const colorClass = model === "pro" ? "border-primary ring-1 ring-primary" : "border-border";
  const accentClass = model === "pro" ? "text-primary" : "text-foreground";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {packages.map((pkg) => (
        <Card
          key={pkg.id}
          className={`overflow-hidden transition-all ${pkg.popular ? colorClass : "border-border"}`}
          data-testid={`plan-${pkg.id}`}
        >
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{modelName}</p>
                  <h3 className="font-bold text-lg text-foreground">{pkg.cards} карточек</h3>
                </div>
                {pkg.popular && (
                  <Badge className="text-[10px] flex-shrink-0">Выгодно</Badge>
                )}
              </div>
              {pkg.saving > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-md">
                  Экономия {pkg.saving}%
                </span>
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground">{pkg.price.toLocaleString("ru")} ₽</span>
              </div>
              <p className={`text-xs font-semibold mt-0.5 ${accentClass}`}>
                {pkg.perCard.toFixed(1)} ₽ / карточка
              </p>
            </div>

            <Separator />

            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>{pkg.cards} генераций</span>
              </li>
              <li className="flex items-center gap-2 text-xs">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>{model === "pro" ? "2K качество" : "1K качество"}</span>
              </li>
              <li className="flex items-center gap-2 text-xs">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>Без срока действия</span>
              </li>
            </ul>

            <Button
              className="w-full"
              variant={pkg.popular ? "default" : "outline"}
              onClick={() => handlePay(pkg.id)}
              disabled={loadingId !== null}
              data-testid={`pay-${pkg.id}`}
            >
              {loadingId === pkg.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Оплатить"
              )}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

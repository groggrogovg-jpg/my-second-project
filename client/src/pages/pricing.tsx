import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Check, ArrowLeft, Zap, Crown, Package, Star, FlaskConical, Loader2 } from "lucide-react";
import { PRICING_PLANS, SUBSCRIPTION_PLANS, TEST_MODE, getPrice, starsToGenerations } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type Tab = "single" | "packages" | "subscriptions";

function formatPrice(price: number) {
  return getPrice(price).toLocaleString("ru");
}

export default function Pricing() {
  const [tab, setTab] = useState<Tab>("packages");

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
          {TEST_MODE && (
            <Badge variant="outline" className="ml-auto text-[10px] sm:text-xs border-orange-400 text-orange-500 bg-orange-500/10 flex items-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-0.5">
              <FlaskConical className="w-3 h-3" />
              <span className="hidden sm:inline">Тестовый режим · цены ÷100</span>
              <span className="sm:hidden">Тест</span>
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-3 sm:mb-4">
            <Zap className="w-3 h-3" />
            Тарифы и цены
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-3 tracking-tight">
            <span className="sm:hidden">Выберите удобный формат</span>
            <span className="hidden sm:inline">Выберите удобный<br />формат работы</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-3 sm:mb-4 px-1">
            ИИ создаёт профессиональные карточки для маркетплейсов. Оплата через ЮMoney — быстро и безопасно.
          </p>
          <StarRatioExplainer />
        </div>

        <div className="flex justify-center mb-6 sm:mb-10">
          <div className="inline-flex bg-muted rounded-lg p-1 gap-1 w-full sm:w-auto">
            {(
              [
                { id: "single", label: "Поштучно", icon: Sparkles },
                { id: "packages", label: "Пакеты", icon: Package },
                { id: "subscriptions", label: "Подписка", icon: Crown },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-testid={`tab-${id}`}
                onClick={() => setTab(id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${
                  tab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === "single" && <SinglePricing />}
        {tab === "packages" && <PackagesPricing />}
        {tab === "subscriptions" && <SubscriptionsPricing />}
      </main>
    </div>
  );
}

function StarRatioExplainer() {
  return (
    <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-card border border-border rounded-xl px-3 py-2 sm:px-5 sm:py-3 text-sm max-w-[calc(100vw-1.5rem)]">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        <span className="font-semibold text-foreground">Система звёзд</span>
      </div>
      <Separator orientation="vertical" className="hidden sm:block h-4" />
      <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="font-semibold text-amber-600">7 ⭐</span>
          <span>= 1 кард Pro (2K)</span>
        </span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-amber-600">3 ⭐</span>
          <span>= 1 кард Nano2 (1K)</span>
        </span>
        {TEST_MODE && (
          <>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1 text-orange-500 font-medium">
              <FlaskConical className="w-3 h-3" />
              <span className="hidden sm:inline">Цены тестовые ÷100</span>
              <span className="sm:hidden">Тест</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function GenerationBadges({ stars }: { stars: number }) {
  const gens = starsToGenerations(stars);
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
      <div className="flex items-center gap-1 sm:gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1">
        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        <span className="text-[10px] sm:text-xs font-semibold text-amber-600">{stars} звёзд</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5 bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[10px] sm:text-xs text-primary font-medium">{gens.pro} Pro-кард</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5 bg-muted border border-border rounded-md px-2 py-0.5 sm:px-2.5 sm:py-1">
        <Zap className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{gens.nano2} Nano2-кард</span>
      </div>
    </div>
  );
}

function PayButton({
  planId,
  planType,
  price,
  stars,
  label,
}: {
  planId: string;
  planType: "single" | "package" | "subscription";
  price: number;
  stars: number;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const displayPrice = `${formatPrice(price)} ₽`;

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, planType }),
      });

      const text = await res.text();
      if (!text.trim()) {
        throw new Error("Сервер вернул пустой ответ. Попробуйте ещё раз.");
      }
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Ошибка сервера (некорректный ответ). Попробуйте ещё раз.`);
      }

      if (data.url) {
        localStorage.setItem("kardo_pending_payment", JSON.stringify({ label: data.label, stars: data.stars }));
        window.open(data.url, "_blank");
        toast({
          title: "Переход к оплате",
          description: `После оплаты звёзды зачислятся автоматически. Сумма: ${displayPrice}`,
        });
      } else {
        throw new Error(data.error || "Ошибка при создании платежа");
      }
    } catch (err: any) {
      toast({ title: "Ошибка оплаты", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      className="w-full"
      onClick={handlePay}
      disabled={loading}
      data-testid={`pay-${label}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Создание платежа...
        </>
      ) : (
        `Оплатить через ЮMoney · ${displayPrice}`
      )}
    </Button>
  );
}

function SinglePricing() {
  const plan = PRICING_PLANS.find((p) => p.id === "single")!;
  return (
    <div className="max-w-sm mx-auto">
      <Card className="overflow-hidden border-primary ring-1 ring-primary" data-testid="plan-single">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg sm:text-xl text-foreground">{plan.name}</h3>
              <Badge className="text-[10px] sm:text-xs">Быстрый старт</Badge>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm">Идеально для пробного заказа или единичного товара</p>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold text-foreground">{formatPrice(plan.price)} ₽</span>
              {TEST_MODE && (
                <span className="text-xs text-muted-foreground line-through">{plan.price.toLocaleString("ru")} ₽</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{plan.unit}</p>
            <GenerationBadges stars={plan.starsIncluded} />
          </div>
          <Separator />
          <ul className="space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                <span className="text-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <PayButton planId={plan.id} planType="single" price={plan.price} stars={plan.starsIncluded} label="single" />
        </div>
      </Card>
    </div>
  );
}

function PackagesPricing() {
  const packages = PRICING_PLANS.filter((p) => p.id !== "single");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {packages.map((plan) => (
        <Card
          key={plan.id}
          className={`overflow-hidden transition-all ${plan.popular ? "border-primary ring-1 ring-primary" : "border-border"}`}
          data-testid={`plan-${plan.id}`}
        >
          <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
            <div>
              <div className="flex items-start justify-between mb-1.5">
                <h3 className="font-bold text-base sm:text-lg text-foreground">{plan.name}</h3>
                {plan.popular && <Badge className="text-[10px] sm:text-xs">Популярный</Badge>}
              </div>
              <p className="text-muted-foreground text-xs">{plan.cards} карточек</p>
            </div>
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-bold text-foreground">{formatPrice(plan.price)} ₽</span>
                {TEST_MODE && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground line-through">{plan.price.toLocaleString("ru")} ₽</span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{plan.unit}</p>
              <GenerationBadges stars={plan.starsIncluded} />
            </div>
            <Separator />
            <ul className="space-y-1.5 sm:space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[10px] sm:text-xs">
                  <Check className={`w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0 ${f.includes("Экономия") ? "text-primary" : "text-green-500"}`} />
                  <span className={`${f.includes("Экономия") ? "text-primary font-semibold" : "text-foreground"}`}>{f}</span>
                </li>
              ))}
            </ul>
            <PayButton planId={plan.id} planType="package" price={plan.price} stars={plan.starsIncluded} label={`package-${plan.id}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function SubscriptionsPricing() {
  return (
    <div>
      <div className="text-center mb-6">
        <Badge variant="secondary" className="text-xs">
          <Crown className="w-3 h-3 mr-1" />
          Ежемесячная подписка для селлеров
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={`overflow-hidden ${plan.popular ? "border-primary ring-1 ring-primary" : "border-border"}`}
            data-testid={`sub-${plan.id}`}
          >
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-start justify-between mb-1.5">
                  <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                  {plan.popular && <Badge className="text-xs">Выгодный</Badge>}
                </div>
                <p className="text-muted-foreground text-xs">{plan.perCard} ₽/карточка</p>
              </div>
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-foreground">{formatPrice(plan.price)} ₽</span>
                  {TEST_MODE && (
                    <span className="text-xs text-muted-foreground line-through">{plan.price.toLocaleString("ru")} ₽</span>
                  )}
                  <span className="text-muted-foreground text-sm">/мес</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.cards} карточек в месяц</p>
                <GenerationBadges stars={plan.starsIncluded} />
              </div>
              <Separator />
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <PayButton planId={plan.id} planType="subscription" price={plan.price} stars={plan.starsIncluded} label={`sub-${plan.id}`} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

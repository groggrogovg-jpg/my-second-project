import { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Check, ArrowLeft, Zap, Crown, Package, Loader2 } from "lucide-react";
import { NANO2_PACKAGES, PRO_PACKAGES } from "@shared/schema";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";

type ModelTab = "nano2" | "pro";

export default function Pricing() {
  const [tab, setTab] = useState<ModelTab>("pro");

  return (
    <div className="min-h-screen bg-background">
      <Header showBack backHref="/" />
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
            <span className="text-muted-foreground">3 карточек бесплатно при регистрации</span>
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
            💳 <span className="font-medium text-foreground">Оплата работает!</span> Принимаем банковские карты, SberPay и ЮMoney. По вопросам:{" "}
            <a href="mailto:hello@kardomatik.ru" className="text-primary hover:underline">
              hello@kardomatik.ru
            </a>
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 sm:p-8 space-y-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Почему Nano Banana Pro?</h2>
            <p className="text-sm text-muted-foreground">
              Nano Banana Pro — наша флагманская диффузионная модель, обученная специально на изображениях товаров для российских маркетплейсов. Она выдаёт результат заметно выше среднего по рынку.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-3">Что умеет</h3>
            <ul className="space-y-2">
              {[
                "Генерирует карточки с разрешением 2K — чёткие, без артефактов",
                "Удаляет фон и заменяет его на студийный или тематический",
                "Добавляет инфографику и продающие элементы прямо в изображение",
                "Сохраняет текстуру и цвет материала без потерь",
                "Поддерживает любые категории товаров: одежда, электроника, еда, бьюти",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-3">Чем отличается от базовой модели</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-1/3">Параметр</th>
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Nano Banana 2</th>
                    <th className="text-left py-2 font-medium text-primary">Nano Banana Pro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Разрешение", "1K (1024 px)", "2K (2048 px)"],
                    ["Детализация текстур", "Базовая", "Высокая"],
                    ["Инфографика в карточке", "✓", "✓"],
                    ["Качество фона", "Стандартное", "Студийное"],
                    ["Цена за карточку", "от 35 ₽", "от 55 ₽"],
                  ].map(([param, nano2, pro]) => (
                    <tr key={param} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 text-muted-foreground font-medium">{param}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{nano2}</td>
                      <td className="py-2.5 text-foreground font-medium">{pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-3">Почему это стоит своих денег</h3>
            <ul className="space-y-2">
              {[
                "Профессиональный фотограф за одну карточку берёт от 500 ₽ — Pro стоит в 10 раз дешевле",
                "Дизайнер тратит часы на ретушь; ИИ выдаёт результат за 2 минуты",
                "Красивая карточка повышает CTR и конверсию — окупается с первых продаж",
                "Пакеты не сгорают: купите один раз и используйте в удобном темпе",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
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
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});

  const handlePay = async (packageId: string) => {
    setLoadingId(packageId);
    try {
      // username берётся из сессии на сервере
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
  const audienceByCards: Record<number, string> = {
    5: "Для пробных запусков",
    10: "Для фрилансеров и малого бизнеса",
    50: "Для активных селлеров и агентств",
    100: "Для оптовых заказов и больших проектов",
  };

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
                  <p className="text-xs text-muted-foreground mt-1">{audienceByCards[pkg.cards]}</p>
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
                <span>Действует 30 дней</span>
              </li>
            </ul>

            <Button
              className="w-full"
              variant={pkg.popular ? "default" : "outline"}
              onClick={() => handlePay(pkg.id)}
              disabled={loadingId !== null || !agreed[pkg.id]}
              data-testid={`pay-${pkg.id}`}
            >
              {loadingId === pkg.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Оплатить"
              )}
            </Button>

            <div className="flex items-start gap-2 mt-2">
              <Checkbox
                id={`agree-${pkg.id}`}
                checked={!!agreed[pkg.id]}
                onCheckedChange={(checked) =>
                  setAgreed((prev) => ({ ...prev, [pkg.id]: checked === true }))
                }
                className="mt-0.5"
              />
              <Label
                htmlFor={`agree-${pkg.id}`}
                className="text-xs text-muted-foreground leading-snug cursor-pointer"
              >
                Принимаю{" "}
                <Link
                  href="/legal/subscription-agreement"
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  соглашение о подписке
                </Link>
                {" "}и{" "}
                <Link
                  href="/privacy-policy"
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Политику конфиденциальности
                </Link>
              </Label>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

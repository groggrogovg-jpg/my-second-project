import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Check, Zap, Crown, Package } from "lucide-react";
import { NANO2_PACKAGES, PRO_PACKAGES, STAR_PACKAGES } from "@shared/schema";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";

type ModelTab = "nano2" | "pro";
type PaymentProvider = "yoomoney" | "yookassa" | "sbp";

export default function Pricing() {
  const [tab, setTab] = useState<ModelTab>("pro");
  const [isAuth, setIsAuth] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => setIsAuth(res.ok))
      .catch(() => setIsAuth(false));
  }, []);

  const openLogin = () => {
    window.location.href = "/app?auth=login";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        showBack
        backHref="/"
        isAuth={isAuth}
        onLogin={openLogin}
        desktopRight={!isAuth ? (
          <Button size="sm" variant="outline" onClick={openLogin}>Войти</Button>
        ) : undefined}
      />
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
            <span className="text-muted-foreground">2 карточки бесплатно при регистрации</span>
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

        <StarsPackagesGrid
          isAuth={isAuth}
          onLogin={openLogin}
          toast={toast}
        />

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
             💳 <span className="font-medium text-foreground">Оплата работает!</span> Принимаем банковские карты, SberPay, ЮMoney и ЮKassa. По вопросам:{" "}
            <a href="mailto:support@kardomatik.ru" className="text-primary hover:underline">
              support@kardomatik.ru
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

function StarsPackagesGrid({
  isAuth,
  onLogin,
  toast,
}: {
  isAuth: boolean;
  onLogin: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [, navigate] = useLocation();

  return (
    <section className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 sm:p-8 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-5 text-center">
        <div className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
          <Sparkles className="h-5 w-5" />
          <h2 className="text-xl sm:text-2xl font-bold">Пополнить звёзды</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Звёзды используются для удаления фона, ретуши и других инструментов редактора.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAR_PACKAGES.map((pkg) => (
          <Card key={pkg.id} className="border-amber-200 bg-background dark:border-amber-900/50">
            <div className="space-y-3 p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">+{pkg.stars} ⭐</div>
              <p className="text-sm font-semibold text-foreground">{pkg.price.toLocaleString("ru")} ₽</p>
              <p className="min-h-8 text-xs text-muted-foreground">{pkg.description}</p>
              <Button
                className="w-full"
                 variant="default"
                 onClick={() => {
                   if (!isAuth) {
                     onLogin();
                     return;
                   }
                   navigate(`/payment?type=stars&packageId=${encodeURIComponent(pkg.id)}`);
                 }}
                 disabled={!agreed[pkg.id]}
                data-testid={`buy-stars-${pkg.id}`}
              >
                Оплатить
              </Button>

              <div className="flex items-start gap-2 text-left">
                <Checkbox
                  id={`agree-stars-${pkg.id}`}
                  checked={!!agreed[pkg.id]}
                  onCheckedChange={(checked) =>
                    setAgreed((prev) => ({ ...prev, [pkg.id]: checked === true }))
                  }
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`agree-stars-${pkg.id}`}
                  className="text-xs text-muted-foreground leading-snug cursor-pointer"
                >
                  Принимаю{" "}
                  <Link
                    href="/legal/subscription-agreement"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Соглашение о подписке
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
    </section>
  );
}

function PackagesGrid({
  model,
  packages,
}: {
  model: "nano2" | "pro";
  packages: readonly { id: string; cards: number; starsIncluded: number; price: number; perCard: number; saving: number; popular: boolean }[];
}) {
  const { toast } = useToast();
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [, navigate] = useLocation();

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

            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
              <Sparkles className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-amber-700 dark:text-amber-300">
                  +{pkg.starsIncluded} ⭐ на баланс
                </p>
                <p className="text-[11px] leading-tight text-amber-700/70 dark:text-amber-300/70">
                  для инструментов редактора
                </p>
              </div>
            </div>

            <Separator />

            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span>{pkg.cards === 10 ? "11 генераций (10 + 1 в подарок)" : `${pkg.cards} генераций`}</span>
              </li>
              {pkg.cards === 10 && (
                <li className="flex items-center gap-2 text-xs">
                  <span aria-hidden="true">🎁</span>
                  <span>При покупке 10 карточек вы получаете 11 карточек (1 в подарок)</span>
                </li>
              )}
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
              onClick={() => navigate(`/payment?type=cards&packageId=${encodeURIComponent(pkg.id)}`)}
              disabled={!agreed[pkg.id]}
              data-testid={`pay-${pkg.id}`}
            >
              Оплатить
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

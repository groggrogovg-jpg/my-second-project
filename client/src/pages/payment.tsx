import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/header";
import { NANO2_PACKAGES, PRO_PACKAGES, STAR_PACKAGES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type PaymentProvider = "yoomoney" | "yookassa" | "sbp";
type PaymentType = "cards" | "stars";

const PAYMENT_METHODS: {
  value: PaymentProvider;
  title: string;
  description: string;
  tone: string;
}[] = [
  {
    value: "yookassa",
    title: "ЮKassa",
    description: "Банковская карта, SberPay и другие доступные способы",
    tone: "border-primary/60 bg-primary/5",
  },
  {
    value: "yoomoney",
    title: "ЮMoney",
    description: "Оплата через защищённую страницу ЮMoney",
    tone: "border-border bg-card",
  },
  {
    value: "sbp",
    title: "СБП",
    description: "Оплата по QR-коду в приложении банка",
    tone: "border-border bg-card",
  },
];

type SelectedProduct =
  | {
      type: "cards";
      id: string;
      title: string;
      details: string;
      price: number;
      bonus: string;
    }
  | {
      type: "stars";
      id: string;
      title: string;
      details: string;
      price: number;
      bonus: string;
    };

export default function Payment() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentProvider>("yookassa");

  const product = useMemo<SelectedProduct | null>(() => {
    const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : window.location.search;
    const params = new URLSearchParams(query);
    const type: PaymentType = params.get("type") === "stars" ? "stars" : "cards";
    const packageId = params.get("packageId") || "";

    if (type === "stars") {
      const selected = STAR_PACKAGES.find((pkg) => pkg.id === packageId);
      if (!selected) return null;
      return {
        type,
        id: selected.id,
        title: `${selected.stars} звёзд`,
        details: selected.description,
        price: selected.price,
        bonus: "Для инструментов редактора",
      };
    }

    const selected = [...NANO2_PACKAGES, ...PRO_PACKAGES].find((pkg) => pkg.id === packageId);
    if (!selected) return null;
    const model = selected.id.startsWith("pro-") ? "Nano Banana Pro" : "Nano Banana 2";
    return {
      type,
      id: selected.id,
      title: `${selected.cards} карточек`,
      details: model,
      price: selected.price,
      bonus: `+${selected.starsIncluded} ⭐ на баланс`,
    };
  }, [location]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => setIsAuth(res.ok))
      .catch(() => setIsAuth(false));
  }, []);

  const openLogin = () => {
    window.location.href = "/app?auth=login";
  };

  const handlePayment = async () => {
    if (!product) return;
    if (!isAuth) {
      openLogin();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: product.id,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        openLogin();
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Ошибка при создании платежа");
      }
      window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Ошибка оплаты",
        description: error.message || "Не удалось создать платёж. Попробуйте позже.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header showBack backHref="/pricing" isAuth={isAuth} onLogin={openLogin} />
        <main className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Пакет не найден</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Вернитесь к тарифам и выберите пакет ещё раз.
          </p>
          <Button onClick={() => navigate("/pricing")}>Вернуться к тарифам</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        showBack
        backHref="/pricing"
        isAuth={isAuth}
        onLogin={openLogin}
        desktopRight={!isAuth ? (
          <Button size="sm" variant="outline" onClick={openLogin}>Войти</Button>
        ) : undefined}
      />

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-8">
          <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5">
            <ArrowLeft className="w-4 h-4" />
            Вернуться к пакетам
          </Link>
          <div className="flex items-center gap-2 text-primary mb-2">
            <CreditCard className="w-5 h-5" />
            <span className="text-sm font-medium">Безопасная оплата</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Выберите способ оплаты</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Сначала проверьте заказ, затем выберите удобный способ оплаты.
          </p>
        </div>

        <Card className="mb-6 border-primary/20 bg-primary/5">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {product.type === "cards" ? product.details : "Пополнение баланса"}
                </p>
                <h2 className="text-xl font-bold text-foreground">{product.title}</h2>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  {product.bonus}
                </div>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-foreground whitespace-nowrap">
                {product.price.toLocaleString("ru")} ₽
              </span>
            </div>
          </div>
        </Card>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Способ оплаты</h2>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as PaymentProvider)}
            className="gap-3"
            aria-label="Способ оплаты"
          >
            {PAYMENT_METHODS.map((method) => (
              <Label
                key={method.value}
                htmlFor={`payment-method-${method.value}`}
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                  paymentMethod === method.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : method.tone
                }`}
                data-testid={`payment-method-${method.value}`}
              >
                <RadioGroupItem
                  value={method.value}
                  id={`payment-method-${method.value}`}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{method.title}</span>
                  <span className="block text-sm text-muted-foreground mt-0.5">{method.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </section>

        <div className="mt-6 rounded-lg bg-muted/40 px-4 py-3 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 text-green-600 mt-0.5" />
          <span>Платёж обрабатывается выбранным платёжным сервисом. Данные банковской карты не хранятся в КардоМатик.</span>
        </div>

        <Button
          className="w-full mt-6 h-11"
          onClick={handlePayment}
          disabled={loading}
          data-testid="payment-submit"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isAuth ? "Перейти к оплате" : "Войти и продолжить"}
        </Button>

        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-600" /> Без подписок и автосписаний</p>
          <p className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-green-600" /> Пакет действует 30 дней</p>
        </div>
      </main>
    </div>
  );
}
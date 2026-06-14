import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, Star, Sparkles, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STARS_KEY = "kardo_stars";

function getStars(): number {
  const stored = localStorage.getItem(STARS_KEY);
  if (stored && !isNaN(Number(stored))) return Number(stored);
  return 0;
}

export default function PaymentSuccess() {
  const [starsAdded, setStarsAdded] = useState(0);
  const [alreadyCredited, setAlreadyCredited] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const label = params.get("label") || "";
    const starsFromUrl = Number(params.get("stars") || "0");

    if (!label) return;

    const creditedKey = `kardo_credited_${label}`;
    if (localStorage.getItem(creditedKey)) {
      setAlreadyCredited(true);
      setStarsAdded(starsFromUrl);
      return;
    }

    const creditStars = (amount: number) => {
      const current = getStars();
      localStorage.setItem(STARS_KEY, String(current + amount));
      localStorage.setItem(creditedKey, "1");
      localStorage.removeItem("kardo_pending_payment");
      setStarsAdded(amount);
      fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      }).catch(() => {});
    };

    if (starsFromUrl > 0) {
      creditStars(starsFromUrl);
    } else {
      setVerifying(true);
      fetch(`/api/payment/verify?label=${encodeURIComponent(label)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.paid && data.stars > 0) {
            creditStars(data.stars);
          } else {
            setVerifyFailed(true);
          }
        })
        .catch(() => setVerifyFailed(true))
        .finally(() => setVerifying(false));
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            {verifying ? (
              <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
            ) : verifyFailed ? (
              <AlertCircle className="w-10 h-10 text-yellow-500" />
            ) : (
              <CheckCircle className="w-10 h-10 text-green-500" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {verifying ? "Проверяем платёж..." : verifyFailed ? "Платёж на проверке" : "Оплата прошла успешно!"}
          </h1>
          {verifying ? (
            <p className="text-muted-foreground">Запрашиваем подтверждение от ЮMoney...</p>
          ) : alreadyCredited ? (
            <p className="text-muted-foreground">Звёзды уже были зачислены ранее.</p>
          ) : verifyFailed ? (
            <p className="text-muted-foreground">
              Платёж получен, звёзды будут зачислены автоматически. Вернитесь на главную — они появятся в течение минуты.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Спасибо за покупку. Звёзды добавлены на ваш баланс.
            </p>
          )}
        </div>

        {starsAdded > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              <span className="text-3xl font-bold text-amber-600">+{starsAdded}</span>
              <span className="text-lg text-amber-600 font-medium">звёзд</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Теперь на вашем счету{" "}
              <span className="font-semibold text-foreground">{getStars()} ⭐</span>
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="gap-2">
            <Link href="/">
              <Sparkles className="w-4 h-4" />
              Создать карточку
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pricing">Тарифы</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

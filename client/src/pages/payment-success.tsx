import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, Sparkles, ArrowRight, Loader2, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const NANO2_KEY = "kardo_nano2_balance";
const PRO_KEY = "kardo_pro_balance";
const STARS_KEY = "kardo_stars";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // ~1 minute

function getBalance(key: string): number {
  const stored = localStorage.getItem(key);
  if (stored && !isNaN(Number(stored))) return Number(stored);
  return 0;
}

export default function PaymentSuccess() {
  const [cardsAdded, setCardsAdded] = useState(0);
  const [starsAdded, setStarsAdded] = useState(0);
  const [model, setModel] = useState<"nano2" | "pro" | null>(null);
  const [alreadyCredited, setAlreadyCredited] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const label = params.get("label") || "";
    const cardsFromUrl = Number(params.get("cards") || "0");
    const rawModel = params.get("model") || "";
    const modelFromUrl: "nano2" | "pro" | "" =
      rawModel === "nano2" || rawModel === "pro" ? rawModel : "";
    const starsFromUrl = Number(params.get("stars") || "0");

    if (!label) return;

    const creditedKey = `kardo_credited_${label}`;
    if (localStorage.getItem(creditedKey)) {
      setAlreadyCredited(true);
      if (cardsFromUrl > 0 && modelFromUrl) {
        setCardsAdded(cardsFromUrl);
        setModel(modelFromUrl);
        setCurrentBalance(getBalance(modelFromUrl === "pro" ? PRO_KEY : NANO2_KEY));
      } else {
        setStarsAdded(starsFromUrl);
      }
      return;
    }

    const creditCards = (cards: number, mdl: "nano2" | "pro") => {
      const balKey = mdl === "pro" ? PRO_KEY : NANO2_KEY;
      const current = getBalance(balKey);
      localStorage.setItem(balKey, String(current + cards));
      localStorage.setItem(creditedKey, "1");
      localStorage.removeItem("kardo_pending_payment");
      setCardsAdded(cards);
      setModel(mdl);
      setCurrentBalance(current + cards);
      fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      }).catch(() => {});
    };

    const creditStars = (amount: number) => {
      const current = getBalance(STARS_KEY);
      localStorage.setItem(STARS_KEY, String(current + amount));
      localStorage.setItem(creditedKey, "1");
      localStorage.removeItem("kardo_pending_payment");
      setStarsAdded(amount);
    };

    // Если параметры есть в URL (основной flow) — зачисляем сразу
    if (cardsFromUrl > 0 && modelFromUrl) {
      creditCards(cardsFromUrl, modelFromUrl);
      return;
    }
    if (starsFromUrl > 0) {
      creditStars(starsFromUrl);
      return;
    }

    // Иначе — ждём подтверждения через webhook, поллим verify
    setVerifying(true);
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const r = await fetch(`/api/payment/verify?label=${encodeURIComponent(label)}`);
        const data = await r.json();

        if (data.paid) {
          if (pollRef.current) clearInterval(pollRef.current);
          setVerifying(false);
          if (data.cards > 0 && (data.model === "nano2" || data.model === "pro")) {
            creditCards(data.cards, data.model);
          } else if (data.stars > 0) {
            creditStars(data.stars);
          }
          return;
        }
      } catch {
        // продолжаем поллинг
      }

      if (attempts >= POLL_MAX_ATTEMPTS) {
        if (pollRef.current) clearInterval(pollRef.current);
        setVerifying(false);
        setVerifyFailed(true);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const modelLabel = model === "pro" ? "Nano Banana Pro" : "Nano Banana 2";
  const modelColor = model === "pro" ? "text-primary" : "text-amber-600";
  const modelBg = model === "pro" ? "bg-primary/10 border-primary/20" : "bg-amber-500/10 border-amber-500/20";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-3 sm:px-4">
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
            {verifying
              ? "Проверяем платёж..."
              : verifyFailed
              ? "Платёж на проверке"
              : "Оплата прошла успешно!"}
          </h1>
          {verifying ? (
            <p className="text-muted-foreground">Ожидаем подтверждения от ЮMoney...</p>
          ) : alreadyCredited ? (
            <p className="text-muted-foreground">Карточки уже были зачислены ранее.</p>
          ) : verifyFailed ? (
            <p className="text-muted-foreground">
              Платёж получен, карточки будут зачислены автоматически. Вернитесь через минуту — они появятся на балансе.
            </p>
          ) : (
            <p className="text-muted-foreground">Спасибо за покупку. Карточки добавлены на ваш баланс.</p>
          )}
        </div>

        {cardsAdded > 0 && model && (
          <div
            className={`border rounded-2xl p-4 sm:p-6 space-y-2 ${modelBg}`}
            data-testid="payment-success-cards"
          >
            <div className="flex items-center justify-center gap-2">
              <CreditCard className={`w-6 h-6 ${modelColor}`} />
              <span className={`text-3xl font-bold ${modelColor}`}>+{cardsAdded}</span>
              <span className={`text-lg font-medium ${modelColor}`}>карточек</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">{modelLabel}</p>
            <p className="text-sm text-muted-foreground">
              Баланс:{" "}
              <span className="font-semibold text-foreground" data-testid="payment-success-balance">
                {currentBalance} карточек
              </span>
            </p>
          </div>
        )}

        {starsAdded > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 sm:p-6 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-amber-600">+{starsAdded}</span>
              <span className="text-lg text-amber-600 font-medium">⭐ звёзд</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Баланс:{" "}
              <span className="font-semibold text-foreground">{getBalance(STARS_KEY)} ⭐</span>
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button className="gap-2" onClick={() => { window.location.href = "/"; }}>
            <Sparkles className="w-4 h-4" />
            Перейти к генерации
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pricing">Тарифы</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

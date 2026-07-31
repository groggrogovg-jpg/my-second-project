import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, Sparkles, ArrowRight, Loader2, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

const NANO2_KEY = "kardo_nano2_balance";
const PRO_KEY = "kardo_pro_balance";
const STARS_KEY = "kardo_stars";

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 20;

function getBalance(key: string): number {
  const stored = localStorage.getItem(key);
  if (stored && !isNaN(Number(stored))) return Number(stored);
  return 0;
}

export default function PaymentSuccess() {
  const [cardsAdded, setCardsAdded] = useState(0);
  const [starsAdded, setStarsAdded] = useState(0);
  const [starsPackageName, setStarsPackageName] = useState("");
  const [model, setModel] = useState<"nano2" | "pro" | null>(null);
  const [alreadyCredited, setAlreadyCredited] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [currentStarsBalance, setCurrentStarsBalance] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const label = params.get("label") || "";

    if (!label) {
      setVerifyFailed(true);
      return;
    }

    const creditedKey = `kardo_credited_${label}`;
    if (localStorage.getItem(creditedKey)) {
      setAlreadyCredited(true);
      const storedCards = Number(localStorage.getItem(`kardo_credited_cards_${label}`) || "0");
      const storedModel = localStorage.getItem(`kardo_credited_model_${label}`) || "";
      const storedStars = Number(localStorage.getItem(`kardo_credited_stars_${label}`) || "0");
      if (storedCards > 0 && storedModel) {
        setCardsAdded(storedCards);
        setModel(storedModel as "nano2" | "pro");
        setCurrentBalance(getBalance(storedModel === "pro" ? PRO_KEY : NANO2_KEY));
      } else if (storedStars > 0) {
        setStarsAdded(storedStars);
        setStarsPackageName(localStorage.getItem(`kardo_credited_stars_name_${label}`) || "");
      }
      fetch("/api/auth/me")
        .then((res) => res.ok ? res.json() : null)
        .then((user) => {
          if (user && typeof user.starsBalance === "number") {
            setCurrentStarsBalance(user.starsBalance);
          }
        })
        .catch(() => {});
      return;
    }

    const creditCards = async (cards: number, mdl: "nano2" | "pro") => {
      const balKey = mdl === "pro" ? PRO_KEY : NANO2_KEY;
      const current = getBalance(balKey);
      const newBal = current + cards;
      localStorage.setItem(balKey, String(newBal));
      localStorage.setItem(creditedKey, "1");
      localStorage.setItem(`kardo_credited_cards_${label}`, String(cards));
      localStorage.setItem(`kardo_credited_model_${label}`, mdl);
      localStorage.removeItem("kardo_pending_payment");
      setCardsAdded(cards);
      setModel(mdl);
      setCurrentBalance(newBal);
      // Начисляем равное количество звёзд
      const starsCurrent = getBalance(STARS_KEY);
      const starsNew = starsCurrent + cards;
      localStorage.setItem(STARS_KEY, String(starsNew));
      setStarsAdded(cards);
      // Баланс аккаунта уже был начислен сервером атомарно в /api/payment/verify
      // (см. storage.creditConfirmedPayment) — здесь только читаем актуальное значение для отображения.
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const me = await meRes.json();
          setCurrentBalance(mdl === "pro" ? me.proBalance : me.nano2Balance);
        }
      } catch { /* игнорируем если не авторизован */ }
    };

    const creditStars = (amount: number, serverBalance?: number, packageName?: string) => {
      const current = getBalance(STARS_KEY);
      localStorage.setItem(STARS_KEY, String(current + amount));
      localStorage.setItem(creditedKey, "1");
      localStorage.setItem(`kardo_credited_stars_${label}`, String(amount));
      if (packageName) {
        localStorage.setItem(`kardo_credited_stars_name_${label}`, packageName);
      }
      localStorage.removeItem("kardo_pending_payment");
      setStarsAdded(amount);
      setStarsPackageName(packageName || "");
      setCurrentStarsBalance(typeof serverBalance === "number" ? serverBalance : current + amount);
    };

    const cardsFromUrl = Number(params.get("cards") || "0");
    const rawModel = params.get("model") || "";
    const modelFromUrl: "nano2" | "pro" | "" =
      rawModel === "nano2" || rawModel === "pro" ? rawModel : "";
    const starsFromUrl = Number(params.get("stars") || "0");

    const poll = async () => {
      try {
        const r = await fetch(`/api/payment/verify?label=${encodeURIComponent(label)}`);
        const data = await r.json();

        if (data.paid) {
          setVerifying(false);
          if (pollRef.current) clearTimeout(pollRef.current);

          if (data.cards > 0 && data.model) {
            await creditCards(data.cards, data.model as "nano2" | "pro");
          } else if (data.stars > 0) {
            creditStars(data.stars, data.balance?.stars, data.starsPackageName || "");
          } else {
            setVerifyFailed(true);
          }
          return;
        }

        attemptsRef.current += 1;
        if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
          setVerifying(false);
          if (pollRef.current) clearTimeout(pollRef.current);
          // Не начисляем по URL без подтверждения webhook: параметры возврата
          // можно подделать, а источником истины является серверный платёж.
          setVerifyFailed(true);
          return;
        }

        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        attemptsRef.current += 1;
        if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
          setVerifying(false);
          if (pollRef.current) clearTimeout(pollRef.current);
          setVerifyFailed(true);
          return;
        }
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    setVerifying(true);
    poll();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
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
            <p className="text-muted-foreground">
              {starsAdded > 0 ? "Звёзды уже были зачислены ранее." : "Карточки уже были зачислены ранее."}
            </p>
          ) : verifyFailed ? (
            <p className="text-muted-foreground">
              Платёж получен, начисление будет выполнено автоматически. Вернитесь через минуту — покупка появится на балансе.
            </p>
          ) : starsAdded > 0 ? (
            <p className="text-muted-foreground">Спасибо за покупку. Звёзды добавлены на ваш баланс.</p>
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
            {starsPackageName && (
              <p className="text-xs font-medium text-muted-foreground">{starsPackageName}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Баланс:{" "}
              <span className="font-semibold text-foreground">
                {currentStarsBalance ?? getBalance(STARS_KEY)} ⭐
              </span>
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button className="gap-2" data-testid="button-go-generate" onClick={() => { window.location.href = "/"; }}>
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

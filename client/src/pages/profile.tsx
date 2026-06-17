import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  User,
  Package,
  Zap,
  Crown,
  LogOut,
  ShoppingCart,
  Image,
  Wand2,
  Shirt,
  ShieldCheck,
  Loader2,
  LayoutDashboard,
  MessageCircle,
} from "lucide-react";

interface AuthUser {
  id: number;
  username: string;
  nano2Balance: number;
  proBalance: number;
  trialCount: number;
}

export default function Profile() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [totalTryons, setTotalTryons] = useState(0);
  const [isDev, setIsDev] = useState(false);
  const [devCodeInput, setDevCodeInput] = useState("");
  const [devLoading, setDevLoading] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);

  const username = authUser?.username ?? null;
  const nano2 = authUser?.nano2Balance ?? 0;
  const pro = authUser?.proBalance ?? 0;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((user: AuthUser | null) => { if (user) setAuthUser(user); })
      .catch(() => {})
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    fetch("/api/generations")
      .then((r) => r.json())
      .then((data: any[]) => {
        const cards = data.filter((g) => g.generationType === "card" || !g.generationType).length;
        const tryons = data.filter((g) => g.generationType === "tryon").length;
        setTotalCards(cards);
        setTotalTryons(tryons);
      })
      .catch(() => {
        setTotalCards(0);
        setTotalTryons(0);
      });
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAuthUser(null);
    window.location.href = "/app";
  };

  const handleDevCode = async () => {
    if (!devCodeInput.trim()) return;
    setDevLoading(true);
    setDevMessage(null);
    try {
      const res = await fetch("/api/promo/dev-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: devCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Неверный код");
      // Обновляем баланс на сервере
      const newNano2 = nano2 + data.nano2;
      const newPro = pro + data.pro;
      await fetch("/api/auth/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nano2Balance: newNano2, proBalance: newPro }),
      });
      setAuthUser((prev) => prev ? { ...prev, nano2Balance: newNano2, proBalance: newPro } : prev);
      setIsDev(true);
      setDevCodeInput("");
      setDevMessage(data.message);
    } catch (e: any) {
      setDevMessage("❌ " + e.message);
    } finally {
      setDevLoading(false);
    }
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!username) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Вы не вошли в аккаунт</h1>
          <p className="text-sm text-muted-foreground">
            Войдите, чтобы увидеть баланс карточек и историю генераций.
          </p>
          <Link href="/app">
            <Button className="mt-2">Войти / Зарегистрироваться</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {/* User info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{username}</h1>
            <p className="text-xs text-muted-foreground">Личный кабинет КардоМатик</p>
            <a
              href="https://t.me/KardoMatik_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mt-0.5"
              data-testid="link-support"
            >
              <MessageCircle className="w-3 h-3" />
              Поддержка
            </a>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Card className="p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nano Banana 2</p>
                <p className="text-sm font-semibold text-foreground">Эконом</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{nano2}</span>
              <span className="text-xs text-muted-foreground">карточек</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="w-full text-xs gap-1">
                  <ShoppingCart className="w-3 h-3" />
                  Купить
                </Button>
              </Link>
              <Link href="/app">
                <Button size="sm" className="w-full text-xs gap-1">
                  <Wand2 className="w-3 h-3" />
                  Генерировать
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nano Banana Pro</p>
                <p className="text-sm font-semibold text-foreground">Премиум</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{pro}</span>
              <span className="text-xs text-muted-foreground">карточек</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="w-full text-xs gap-1">
                  <ShoppingCart className="w-3 h-3" />
                  Купить
                </Button>
              </Link>
              <Link href="/app">
                <Button size="sm" className="w-full text-xs gap-1">
                  <Wand2 className="w-3 h-3" />
                  Генерировать
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Stats */}
        <Card className="p-4 border border-border mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Статистика</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Image className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{totalCards}</p>
                <p className="text-xs text-muted-foreground">Карточек создано</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Shirt className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{totalTryons}</p>
                <p className="text-xs text-muted-foreground">Примерок одежды</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Info */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 mb-6">
          <p className="text-xs font-semibold text-foreground">Как работают балансы</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            При каждой генерации карточки списывается 1 единица из соответствующего баланса.
            Примерка одежды списывает 1 карточку из баланса Nano Banana 2.
            Пополните баланс на странице Тарифов.
          </p>
        </div>

        {/* Developer section */}
        {isDev ? (
          <Card className="p-4 border border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Режим разработчика</span>
              <Badge variant="secondary" className="ml-auto text-xs">Активен</Badge>
            </div>
            <Separator />
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-1.5 w-full" data-testid="button-go-admin">
                <LayoutDashboard className="w-3.5 h-3.5" />
                Открыть панель администратора
              </Button>
            </Link>
          </Card>
        ) : (
          <Card className="p-4 border border-border space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Код разработчика</span>
            </div>
            <p className="text-xs text-muted-foreground">Введите код для активации режима разработчика и пополнения баланса.</p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Введите код..."
                value={devCodeInput}
                onChange={(e) => setDevCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDevCode()}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-dev-code"
              />
              <Button size="sm" onClick={handleDevCode} disabled={devLoading || !devCodeInput.trim()} data-testid="button-activate-dev">
                {devLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Активировать"}
              </Button>
            </div>
            {devMessage && (
              <p className={`text-xs font-medium ${devMessage.startsWith("❌") ? "text-destructive" : "text-green-600"}`}>{devMessage}</p>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
        <Link href="/app">
          <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Назад</span>
          </button>
        </Link>
        <div className="flex items-center gap-2 ml-1">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm text-foreground">КардоМатик</span>
        </div>
      </div>
    </header>
  );
}

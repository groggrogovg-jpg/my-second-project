import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  User,
  Zap,
  Crown,
  LogOut,
  ShoppingCart,
  Image,
  Wand2,
  Shirt,
  MessageCircle,
} from "lucide-react";
import { Header } from "@/components/header";
import { formatSubscriptionExpiry } from "@/lib/utils";

interface AuthUser {
  id: string;
  username: string;
  email?: string;
  nano2Balance: number;
  proBalance: number;
  starsBalance: number;
  nano2ExpiresAt: string;
  proExpiresAt: string;
  trialNano2Used: boolean;
  trialNano2Count: number;
  trialProUsed: boolean;
  trialTryonUsed: boolean;
}

export default function Profile() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [totalTryons, setTotalTryons] = useState(0);

  const username = authUser?.username ?? null;
  const nano2 = authUser?.nano2Balance ?? 0;
  const pro = authUser?.proBalance ?? 0;
  const stars = authUser?.starsBalance ?? 0;

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
        <Header showBack backHref="/app" />
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
      <Header showBack backHref="/app" isAuth onLogout={handleLogout} />

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
          <Card className="p-4 border border-amber-300/40 bg-amber-500/5 sm:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-amber-500/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Общий баланс дополнительных действий</p>
                <p className="text-2xl font-bold text-foreground">{stars} ⭐</p>
              </div>
              <Link href="/pricing" className="ml-auto">
                <Button size="sm" variant="outline">Пополнить</Button>
              </Link>
            </div>
          </Card>
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
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatSubscriptionExpiry(authUser?.nano2ExpiresAt ?? new Date().toISOString(), nano2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Пробные генерации: {Math.min(authUser?.trialNano2Count ?? (authUser?.trialNano2Used ? 1 : 0), 2)} из 2 использовано
            </p>
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
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatSubscriptionExpiry(authUser?.proExpiresAt ?? new Date().toISOString(), pro)}
            </p>
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

      </main>
    </div>
  );
}


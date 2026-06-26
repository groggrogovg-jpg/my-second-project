import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Sparkles, Users, CreditCard, AlertTriangle,
  RefreshCw, ChevronLeft, ChevronRight, Loader2, ShieldCheck,
  MessageCircle, Send, CircleDot, CheckCircle2,
} from "lucide-react";

const DEV_CODE_KEY = "kardo_dev_code";
const IS_DEV_KEY = "kardo_is_developer";
const PAGE_SIZE = 20;

function getDevCode(): string {
  return localStorage.getItem(DEV_CODE_KEY) || "";
}

function adminHeaders() {
  return { "Content-Type": "application/json", "x-dev-code": getDevCode() };
}

type AdminTab = "users" | "payments" | "logs" | "support";

interface SupportChat {
  id: string;
  telegramUserId: string;
  lastMessage: string | null;
  lastActivity: string;
  status: "open" | "closed";
  unreadCount: number;
}

interface SupportMessage {
  id: string;
  chatId: string;
  telegramUserId: string | null;
  message: string;
  isFromUser: boolean;
  isRead: boolean;
  createdAt: string;
}

interface ServerUser {
  username: string;
  registeredAt: string;
  generationCount: number;
  pendingNano2: number;
  pendingPro: number;
}

interface PaymentRecord {
  label: string;
  username: string;
  amount: string;
  cardsIncluded: number;
  modelType: string;
  starsToAdd: number;
  confirmed: boolean;
  createdAt: string;
}

interface ErrorLog {
  id: string;
  username: string;
  model: string;
  errorMessage: string;
  generationType: string;
  createdAt: string;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

type LoginView = "login" | "forgot" | "reset";

function getUrlToken(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") || "";
}

export default function Admin() {
  const [isDev, setIsDev] = useState(() => localStorage.getItem(IS_DEV_KEY) === "1");
  const [devCodeInput, setDevCodeInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<AdminTab>("users");
  const [loginView, setLoginView] = useState<LoginView>(() => getUrlToken() ? "reset" : "login");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken, setResetToken] = useState(() => getUrlToken());
  const [resetNewCode, setResetNewCode] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const { toast } = useToast();

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/promo/dev-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: devCodeInput.trim() }),
      });
      if (!res.ok) { throw new Error((await res.json()).error || "Неверный код"); }
      localStorage.setItem(DEV_CODE_KEY, devCodeInput.trim());
      localStorage.setItem(IS_DEV_KEY, "1");
      setIsDev(true);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!forgotIdentifier.trim()) return;
    setForgotLoading(true);
    try {
      const res = await fetch("/api/admin/forgot-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setForgotSent(true);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetToken.trim() || !resetNewCode.trim()) return;
    setResetLoading(true);
    try {
      const res = await fetch("/api/admin/reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken.trim(), newCode: resetNewCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setResetDone(true);
      toast({ title: "Код изменён", description: "Войдите с новым кодом. Код действует до перезапуска сервера." });
      setTimeout(() => {
        setLoginView("login");
        setResetDone(false);
        setResetToken("");
        setResetNewCode("");
        setForgotSent(false);
        setForgotIdentifier("");
      }, 2500);
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setResetLoading(false);
    }
  };

  if (!isDev) {
    if (loginView === "forgot") {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="font-bold text-lg text-foreground">Восстановление доступа</h1>
            </div>
            {!forgotSent ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Введите любой идентификатор (например «admin»). Одноразовая ссылка будет напечатана в консоль сервера и действительна 15 минут.
                </p>
                <input
                  type="text"
                  placeholder="Ваш идентификатор (например: admin)"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleForgot()}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  data-testid="input-forgot-identifier"
                />
                <Button className="w-full" onClick={handleForgot} disabled={forgotLoading || !forgotIdentifier.trim()} data-testid="button-forgot-submit">
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Получить ссылку"}
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm text-green-800 dark:text-green-300" data-testid="text-forgot-sent">
                ✓ Ссылка для сброса напечатана в консоль сервера. Откройте её в браузере или введите токен на странице смены кода.
              </div>
            )}
            <button
              onClick={() => { setLoginView("login"); setForgotSent(false); setForgotIdentifier(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-back-to-login"
            >
              ← Вернуться к входу
            </button>
          </Card>
        </div>
      );
    }

    if (loginView === "reset") {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="font-bold text-lg text-foreground">Смена кода доступа</h1>
            </div>
            <p className="text-sm text-muted-foreground">Введите одноразовый токен из консоли сервера и новый код доступа.</p>
            <input
              type="text"
              placeholder="Одноразовый токен"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              data-testid="input-reset-token"
            />
            <input
              type="password"
              placeholder="Новый код доступа (мин. 4 символа)"
              value={resetNewCode}
              onChange={(e) => setResetNewCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleReset()}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="input-new-code"
            />
            <Button className="w-full" onClick={handleReset} disabled={resetLoading || !resetToken.trim() || !resetNewCode.trim()} data-testid="button-reset-submit">
              {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : resetDone ? "Готово! Перенаправление..." : "Сменить код"}
            </Button>
            <button
              onClick={() => { setLoginView("login"); setResetToken(""); setResetNewCode(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-back-from-reset"
            >
              ← Вернуться к входу
            </button>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg text-foreground">Вход в админ-панель</h1>
          </div>
          <input
            type="password"
            placeholder="Код разработчика"
            value={devCodeInput}
            onChange={(e) => setDevCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="input-admin-code"
          />
          <Button className="w-full" onClick={handleAuth} disabled={authLoading || !devCodeInput.trim()} data-testid="button-admin-auth">
            {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Войти"}
          </Button>
          <div className="flex items-center justify-between">
            <Link href="/app">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-3.5 h-3.5" />На главную
              </Button>
            </Link>
            <button
              onClick={() => setLoginView("forgot")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              data-testid="button-forgot-link"
            >
              Забыли код?
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
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
            <span className="font-bold text-sm text-foreground">КардоМатик — Админ</span>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs">Разработчик</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
          {([
            { id: "users", label: "Пользователи", icon: <Users className="w-3.5 h-3.5" /> },
            { id: "payments", label: "Платежи", icon: <CreditCard className="w-3.5 h-3.5" /> },
            { id: "logs", label: "Логи ошибок", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            { id: "support", label: "Поддержка", icon: <MessageCircle className="w-3.5 h-3.5" /> },
          ] as { id: AdminTab; label: string; icon: React.ReactNode }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === "users" && <UsersTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "logs" && <LogsTab />}
        {tab === "support" && <SupportTab />}
      </main>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{ username: string; action: "nano2" | "pro" | "reset" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: adminHeaders() });
      if (!res.ok) throw new Error("Нет доступа");
      setUsers(await res.json());
    } catch (e: any) {
      toast({ title: "Ошибка загрузки", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!confirmModal) return;
    setActionLoading(true);
    try {
      const { username, action } = confirmModal;
      if (action === "reset") {
        await fetch(`/api/admin/users/${encodeURIComponent(username)}/reset-balance`, {
          method: "POST", headers: adminHeaders(),
        });
        toast({ title: "Баланс сброшен", description: `Следующий вход ${username} обнулит баланс.` });
      } else {
        const body = action === "nano2" ? { nano2Delta: 100 } : { proDelta: 100 };
        await fetch(`/api/admin/users/${encodeURIComponent(username)}/balance`, {
          method: "POST", headers: adminHeaders(), body: JSON.stringify(body),
        });
        toast({ title: "+100 карточек", description: `Будут зачислены при следующем входе ${username}.` });
      }
      setConfirmModal(null);
      await load();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const paged = users.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(users.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Пользователи ({users.length})</h2>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5 h-8">
          <RefreshCw className="w-3.5 h-3.5" />Обновить
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Нет зарегистрированных пользователей. Пользователи появятся после первой генерации.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Пользователь</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Дата входа</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Генераций</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Ожидают</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Действия</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u, i) => (
                  <tr key={u.username} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{u.username}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{fmt(u.registeredAt)}</td>
                    <td className="px-4 py-2.5 text-center text-foreground">{u.generationCount}</td>
                    <td className="px-4 py-2.5 text-center">
                      {(u.pendingNano2 > 0 || u.pendingPro > 0) ? (
                        <span className="text-green-600 font-medium">
                          {u.pendingNano2 > 0 && `N2:+${u.pendingNano2}`}
                          {u.pendingNano2 > 0 && u.pendingPro > 0 && " "}
                          {u.pendingPro > 0 && `Pro:+${u.pendingPro}`}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end flex-wrap">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                          onClick={() => setConfirmModal({ username: u.username, action: "nano2" })}>
                          +100 Nano2
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                          onClick={() => setConfirmModal({ username: u.username, action: "pro" })}>
                          +100 Pro
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setConfirmModal({ username: u.username, action: "reset" })}>
                          Сброс
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <Pagination page={page} total={totalPages} onChange={setPage} />}
        </Card>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Подтверждение</h3>
            <p className="text-sm text-muted-foreground">
              {confirmModal.action === "reset"
                ? `Сбросить баланс пользователя «${confirmModal.username}»?`
                : `Пополнить ${confirmModal.action === "nano2" ? "Nano2" : "Pro"} на +100 для «${confirmModal.username}»?`}
            </p>
            <p className="text-xs text-muted-foreground">Изменение вступит в силу при следующем входе пользователя в приложение.</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={doAction} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Подтвердить"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmModal(null)} disabled={actionLoading}>
                Отмена
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/payments", { headers: adminHeaders() })
      .then((r) => r.json())
      .then(setPayments)
      .catch((e) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const paged = payments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(payments.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-foreground">История платежей ({payments.length})</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : payments.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Платежей пока нет.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Метка</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Дата</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Сумма</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Пакет</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Статус</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p, i) => (
                  <tr key={p.label} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono max-w-[160px] truncate">{p.label}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{fmt(p.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground">{p.amount} ₽</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">
                      {p.cardsIncluded > 0 ? `${p.modelType === "pro" ? "Pro" : "Nano2"} ×${p.cardsIncluded}` : p.starsToAdd > 0 ? `⭐ ${p.starsToAdd}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={p.confirmed ? "default" : "secondary"} className="text-[10px]">
                        {p.confirmed ? "Оплачено" : "Ожидает"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <Pagination page={page} total={totalPages} onChange={setPage} />}
        </Card>
      )}
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs", { headers: adminHeaders() });
      setLogs(await res.json());
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const paged = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(logs.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Логи ошибок ({logs.length})</h2>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5 h-8">
          <RefreshCw className="w-3.5 h-3.5" />Обновить
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Ошибок нет. Отлично!</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Пользователь</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Дата</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Модель</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Тип</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l, i) => (
                  <tr key={l.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{l.username || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{fmt(l.createdAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="outline" className="text-[10px]">
                        {l.model === "nano-banana-pro" ? "Pro" : "Nano2"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground hidden md:table-cell">{l.generationType}</td>
                    <td className="px-4 py-2.5 text-destructive max-w-[300px] truncate" title={l.errorMessage}>{l.errorMessage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <Pagination page={page} total={totalPages} onChange={setPage} />}
        </Card>
      )}
    </div>
  );
}

function SupportTab() {
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch("/api/support/chats", { headers: adminHeaders() });
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setChats(data);
      // If selected chat no longer exists, deselect
      if (selectedChatId && !data.find((c: SupportChat) => c.id === selectedChatId)) {
        setSelectedChatId(null);
        setMessages([]);
      }
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  }, [selectedChatId]);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const res = await fetch(`/api/support/chats/${encodeURIComponent(chatId)}/messages`, { headers: adminHeaders() });
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      setMessages(data);
      // Mark as read
      await fetch(`/api/support/chats/${encodeURIComponent(chatId)}/read`, {
        method: "POST",
        headers: adminHeaders(),
      });
      // Refresh unread counts
      loadChats();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadChats().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (selectedChatId) {
      loadMessages(selectedChatId);
      const id = setInterval(() => loadMessages(selectedChatId), 3000);
      setPollInterval(id);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!replyText.trim() || !selectedChatId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/chats/${encodeURIComponent(selectedChatId)}/reply`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (!res.ok) throw new Error("Ошибка отправки");
      const data = await res.json();
      setReplyText("");
      if (data.sent) {
        toast({ title: "Отправлено", description: "Сообщение доставлено в Telegram" });
      } else {
        toast({ title: "Сохранено", description: "Сообщение сохранено, но не отправлено в Telegram (проверьте токен бота)" });
      }
      await loadMessages(selectedChatId);
      await loadChats();
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Chat list */}
      <Card className="w-72 flex-shrink-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Чаты</span>
          {totalUnread > 0 && (
            <Badge variant="default" className="text-[10px]">{totalUnread} непрочитано</Badge>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Нет активных чатов</div>
          ) : (
            <div className="divide-y divide-border">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`w-full text-left p-3 transition-colors ${selectedChatId === chat.id ? "bg-muted" : "hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate">{chat.telegramUserId}</span>
                    {chat.unreadCount > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{chat.lastMessage || "—"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{fmt(chat.lastActivity)}</span>
                    <Badge variant={chat.status === "open" ? "default" : "secondary"} className="text-[10px] h-4 px-1">
                      {chat.status === "open" ? "Открыт" : "Закрыт"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Chat window */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {selectedChat ? (
          <>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{selectedChat.telegramUserId}</span>
                <Badge variant={selectedChat.status === "open" ? "default" : "secondary"} className="text-[10px]">
                  {selectedChat.status === "open" ? "Открыт" : "Закрыт"}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2"
                  onClick={async () => {
                    const newStatus = selectedChat.status === "open" ? "closed" : "open";
                    await fetch(`/api/support/chats/${encodeURIComponent(selectedChat.id)}/status`, {
                      method: "POST",
                      headers: adminHeaders(),
                      body: JSON.stringify({ status: newStatus }),
                    });
                    loadChats();
                  }}
                >
                  {selectedChat.status === "open" ? "Закрыть" : "Открыть"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => loadMessages(selectedChat.id)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">Нет сообщений</div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isFromUser ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                      msg.isFromUser
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}>
                      <p>{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${msg.isFromUser ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                        {fmt(msg.createdAt)}
                        {!msg.isFromUser && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Оператор
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !sending && handleSend()}
                placeholder="Введите ответ..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid="input-support-reply"
              />
              <Button size="sm" onClick={handleSend} disabled={sending || !replyText.trim()} data-testid="button-send-reply">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Выберите чат из списка слева
          </div>
        )}
      </Card>
    </div>
  );
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
      <span className="text-xs text-muted-foreground">Стр. {page + 1} из {total}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page >= total - 1} onClick={() => onChange(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

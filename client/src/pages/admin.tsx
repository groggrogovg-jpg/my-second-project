import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Sparkles, Users, CreditCard, AlertTriangle,
  RefreshCw, ChevronLeft, ChevronRight, Loader2, ShieldCheck,
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

type AdminTab = "users" | "payments" | "logs";

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

export default function Admin() {
  const [isDev, setIsDev] = useState(() => localStorage.getItem(IS_DEV_KEY) === "1");
  const [devCodeInput, setDevCodeInput] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tab, setTab] = useState<AdminTab>("users");
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

  if (!isDev) {
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
          <Link href="/app">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-3.5 h-3.5" />На главную
            </Button>
          </Link>
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

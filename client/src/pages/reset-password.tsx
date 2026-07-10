import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const [location] = useLocation();
  const [token, setToken] = useState<string>("");
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Извлекаем токен из URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
    if (!t) {
      setValidating(false);
      setTokenValid(false);
      setError("Ссылка не содержит токена. Запросите восстановление пароля повторно.");
      return;
    }

    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((data) => {
        setTokenValid(!!data.valid);
        if (!data.valid) {
          setError("Ссылка недействительна или устарела. Запросите новую ссылку для восстановления пароля.");
        }
      })
      .catch(() => {
        setTokenValid(false);
        setError("Ошибка проверки ссылки. Попробуйте позже.");
      })
      .finally(() => setValidating(false));
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сброса пароля");
      }
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Ошибка соединения");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-3">
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

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6 space-y-4">
          <div className="text-center space-y-1">
            <h1 className="font-bold text-lg text-foreground">Новый пароль</h1>
            <p className="text-xs text-muted-foreground">Придумайте новый пароль для входа в КардоМатик</p>
          </div>

          {validating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : done ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <p className="text-sm text-center text-foreground">Пароль успешно изменён!</p>
              <Link href="/app">
                <Button className="w-full">Войти в аккаунт</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!tokenValid ? (
                <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Новый пароль (минимум 6 символов)"
                      className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting || password.length < 6}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить пароль"}
                  </Button>
                </>
              )}
              {!tokenValid && (
                <Link href="/app">
                  <Button variant="outline" className="w-full mt-2">Запросить ссылку повторно</Button>
                </Link>
              )}
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}

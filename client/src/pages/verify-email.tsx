import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/header";

export default function VerifyEmail() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("Ссылка не содержит токена подтверждения.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ссылка недействительна или устарела");
        setStatus("success");
        setMessage("Email подтверждён. Бесплатные генерации теперь доступны.");
      })
      .catch((error: Error) => {
        setStatus("error");
        setMessage(error.message || "Не удалось подтвердить email.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showBack backHref="/app" />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6 space-y-4 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Проверяем ссылку...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
              <h1 className="font-bold text-lg text-foreground">Email подтверждён</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Link href="/app">
                <Button className="w-full">Перейти в приложение</Button>
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <h1 className="font-bold text-lg text-foreground">Не удалось подтвердить email</h1>
              <p className="text-sm text-destructive">{message}</p>
              <Link href="/app">
                <Button variant="outline" className="w-full">Вернуться в приложение</Button>
              </Link>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
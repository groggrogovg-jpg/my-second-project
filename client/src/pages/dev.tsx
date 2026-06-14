import { useState } from "react";
import { useLocation } from "wouter";

const STARS_KEY = "kardo_stars";

function getStars(): number {
  return Number(localStorage.getItem(STARS_KEY) || "10");
}

export default function DevPage() {
  const [stars, setStars] = useState(getStars);
  const [custom, setCustom] = useState("");
  const [, navigate] = useLocation();

  const set = (n: number) => {
    if (isNaN(n) || n < 0) return;
    localStorage.setItem(STARS_KEY, String(n));
    setStars(n);
    window.dispatchEvent(new StorageEvent("storage", { key: STARS_KEY, newValue: String(n) }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl p-8 shadow-lg w-80 space-y-4">
        <h1 className="text-lg font-bold text-foreground">Dev панель</h1>
        <p className="text-sm text-muted-foreground">
          Текущий баланс: <span className="font-bold text-amber-500">⭐ {stars}</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[20, 50, 100, 500, 1000, 9999].map((n) => (
            <button
              key={n}
              onClick={() => set(n)}
              className="rounded-lg border border-border bg-muted hover:bg-muted/80 py-2 text-sm font-medium transition-colors"
            >
              ⭐ {n}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Своё число"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => { set(Number(custom)); setCustom(""); }}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Задать
          </button>
        </div>
        <button
          onClick={() => set(0)}
          className="w-full rounded-lg border border-destructive/40 text-destructive text-sm py-2 hover:bg-destructive/10 transition-colors"
        >
          Сбросить до 0
        </button>
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-lg border border-border text-sm py-2 hover:bg-muted/50 transition-colors"
        >
          На главную
        </button>
      </div>
    </div>
  );
}

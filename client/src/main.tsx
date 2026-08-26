import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const METRIKA_COUNTER_ID = 111247868;
const METRIKA_SCRIPT_SRC = "https://mc.yandex.ru/metrika/tag.js";

type MetrikaQueue = {
  (counterId: number, methodName: string, ...args: unknown[]): void;
  a?: unknown[][];
  l?: number;
};

function ensureMetrikaLoaded() {
  const metrikaWindow = window as Window & {
    ym?: MetrikaQueue;
    __kardoMetrikaInitialized?: boolean;
  };
  const scriptSelector = `script[src="${METRIKA_SCRIPT_SRC}"]`;

  if (metrikaWindow.ym && document.querySelector(scriptSelector)) return;

  if (!metrikaWindow.ym) {
    const queue = ((...args: unknown[]) => {
      queue.a = queue.a || [];
      queue.a.push(args);
    }) as MetrikaQueue;
    queue.l = Date.now();
    metrikaWindow.ym = queue;
  }

  if (!document.querySelector(scriptSelector)) {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = METRIKA_SCRIPT_SRC;
    document.head.appendChild(script);
  }

  if (!metrikaWindow.__kardoMetrikaInitialized) {
    metrikaWindow.ym(METRIKA_COUNTER_ID, "init", {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
      trackHash: true,
    });
    metrikaWindow.__kardoMetrikaInitialized = true;
  }
}

// The HTML head contains the primary snippet. This fallback covers builds
// created from an older index.html and still injects the tag into <head>.
ensureMetrikaLoaded();

const savedTheme = window.localStorage.getItem("theme");
document.documentElement.classList.toggle("dark", savedTheme === "dark");
document.documentElement.setAttribute("data-theme", savedTheme === "dark" ? "dark" : "light");
document.documentElement.style.colorScheme = savedTheme === "dark" ? "dark" : "light";

createRoot(document.getElementById("root")!).render(<App />);

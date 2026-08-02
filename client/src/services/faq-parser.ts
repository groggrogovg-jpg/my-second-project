import { FAQ_ENTRIES, type FaqEntry } from "@/data/faq";

const CACHE_KEY = "kardomatik-faq-page-cache-v1";
const CACHE_TTL_MS = 60 * 60 * 1000;
const FAQ_SOURCE_PATH = "/faq?faq-source=1";

const STOP_WORDS = new Set([
  "а", "без", "бы", "был", "быть", "в", "вам", "вас", "во", "вот", "все",
  "вы", "где", "да", "для", "до", "его", "ее", "если", "есть", "же", "за",
  "и", "из", "как", "к", "когда", "ли", "мне", "мы", "на", "над", "не",
  "нет", "ни", "но", "о", "об", "от", "по", "под", "при", "про", "с", "со",
  "так", "такой", "тоже", "у", "уже", "что", "это", "я",
]);

interface FaqCache {
  cachedAt: number;
  entries: FaqEntry[];
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function createKeywords(question: string, answer: string): string[] {
  const source = `${question} ${answer}`;
  return Array.from(new Set(
    normalizeText(source)
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word)),
  ));
}

export function parseFaqHtml(html: string): FaqEntry[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const entries = Array.from(document.querySelectorAll<HTMLElement>("[data-faq-item]"))
    .map((item) => {
      const question = item.querySelector<HTMLElement>("[data-faq-question]")?.textContent?.trim() ?? "";
      const answer = item.querySelector<HTMLElement>("[data-faq-answer]")?.textContent?.trim() ?? "";

      return {
        keywords: createKeywords(question, answer),
        question,
        answer,
      };
    })
    .filter((entry) => entry.question && entry.answer);

  return entries;
}

function readCache(): FaqEntry[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw) as FaqCache;
    if (!cache.cachedAt || Date.now() - cache.cachedAt >= CACHE_TTL_MS || !Array.isArray(cache.entries)) {
      return null;
    }

    const validEntries = cache.entries.filter(
      (entry) =>
        typeof entry?.question === "string" &&
        typeof entry?.answer === "string" &&
        Array.isArray(entry?.keywords),
    );
    return validEntries.length > 0 ? validEntries : null;
  } catch (error) {
    console.error("[faq] failed to read cached FAQ data", error);
    return null;
  }
}

function writeCache(entries: FaqEntry[]): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      cachedAt: Date.now(),
      entries,
    } satisfies FaqCache));
  } catch (error) {
    console.error("[faq] failed to cache FAQ data", error);
  }
}

function loadFaqPageHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      iframe.remove();
      reject(new Error("FAQ page loading timed out"));
    }, 8000);

    iframe.title = "FAQ content source";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "absolute";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.left = "-9999px";
    iframe.style.border = "0";

    iframe.addEventListener("load", () => {
      const waitForFaqContent = () => {
        if (settled) return;
        const sourceDocument = iframe.contentDocument;
        const html = sourceDocument?.documentElement?.outerHTML;
        const faqItems = sourceDocument?.querySelectorAll("[data-faq-item]").length ?? 0;

        if (html && faqItems > 0) {
          settled = true;
          window.clearTimeout(timeout);
          iframe.remove();
          resolve(html);
          return;
        }

        window.setTimeout(waitForFaqContent, 50);
      };

      waitForFaqContent();
    }, { once: true });

    iframe.addEventListener("error", () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      iframe.remove();
      reject(new Error("FAQ page failed to load"));
    }, { once: true });

    document.body.appendChild(iframe);
    iframe.src = FAQ_SOURCE_PATH;
  });
}

export async function loadFaqEntries(): Promise<FaqEntry[]> {
  const cachedEntries = readCache();
  if (cachedEntries) return cachedEntries;

  try {
    const html = await loadFaqPageHtml();
    const entries = parseFaqHtml(html);
    if (entries.length === 0) {
      throw new Error("FAQ page did not contain any question/answer pairs");
    }
    writeCache(entries);
    return entries;
  } catch (error) {
    console.error("[faq] failed to parse FAQ page; using fallback data", error);
    return FAQ_ENTRIES;
  }
}
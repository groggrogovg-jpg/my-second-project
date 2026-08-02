import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, ExternalLink, MessageCircle, Send, X } from "lucide-react";
import { FAQ_ENTRIES, type FaqEntry } from "@/data/faq";
import { loadFaqEntries } from "@/services/faq-parser";

const SUPPORT_URL = "https://t.me/KardoMatik_bot";
const STORAGE_KEY = "kardomatik-faq-chat";
const STOP_WORDS = new Set([
  "а", "без", "бы", "был", "быть", "в", "вам", "вас", "во", "вот", "все",
  "вы", "где", "да", "для", "до", "его", "ее", "если", "есть", "же", "за",
  "и", "из", "как", "к", "когда", "ли", "мне", "мы", "на", "над", "не",
  "нет", "ни", "но", "о", "об", "от", "по", "под", "при", "про", "с", "со",
  "так", "такой", "тоже", "у", "уже", "что", "это", "я",
]);

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  showSupportLink?: boolean;
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function stem(word: string): string {
  // A small suffix normalizer is enough to match Russian inflections such as
  // «карточки»/«карточка» and «генерации»/«генерация» without an AI service.
  return word
    .replace(/иями$|ами$|ями$|ого$|его$|ыми$|ими$|ать$|ять$|ить$|еть$|уть$|ю$|ью$|ую$|ое$|ее$|ые$|ие$|ов$|ев$|ам$|ям$|ах$|ях$|ом$|ем$|ой$|ей$|ы$|и$|а$|я$|е$|о$|у$/u, "")
    .replace(/(.)\1+$/u, "$1");
}

function findFaqAnswer(question: string, entries: FaqEntry[]): FaqEntry | null {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = new Set(tokenize(question).map(stem));
  if (questionTokens.size === 0) return null;

  let best: { entry: FaqEntry; score: number; index: number } | null = null;
  for (const [index, entry] of entries.entries()) {
    let score = 0;
    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeText(keyword);
      const keywordTokens = tokenize(keyword).map(stem);
      const phraseMatch = normalizedKeyword.includes(" ")
        ? normalizedQuestion.includes(normalizedKeyword)
        : false;

      if (phraseMatch) {
        score += 4;
        continue;
      }

      if (keywordTokens.some((token) => {
        if (questionTokens.has(token)) return true;
        return [...questionTokens].some((questionToken) =>
          token.length >= 4 && questionToken.length >= 4 &&
          (token.startsWith(questionToken) || questionToken.startsWith(token)),
        );
      })) {
        score += 1;
      }
    }

    if (score > 0 && (!best || score > best.score || (score === best.score && index < best.index))) {
      best = { entry, score, index };
    }
  }

  return best && best.score >= 1 ? best.entry : null;
}

function initialMessages(): ChatMessage[] {
  return [{
    id: "welcome",
    role: "bot",
    text: "Здравствуйте! Я помогу найти ответ по КардоМатик. Задайте вопрос или выберите тему ниже.",
  }];
}

function readSavedMessages(): ChatMessage[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialMessages();
    const parsed = JSON.parse(saved) as ChatMessage[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialMessages();
  } catch {
    return initialMessages();
  }
}

export function FaqChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(readSavedMessages);
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>(FAQ_ENTRIES);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const suggestedQuestions = useMemo(() => faqEntries.slice(0, 4), [faqEntries]);

  useEffect(() => {
    let active = true;
    loadFaqEntries().then((entries) => {
      if (active) setFaqEntries(entries);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages]);

  const sendQuestion = (value = input) => {
    const question = value.trim();
    if (!question) return;

    const answer = findFaqAnswer(question, faqEntries);
    const reply: ChatMessage = answer
      ? { id: `bot-${Date.now()}`, role: "bot", text: answer.answer }
      : {
          id: `bot-${Date.now()}`,
          role: "bot",
          text: "К сожалению, я не нашёл ответа на этот вопрос.",
          showSupportLink: true,
        };

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: question },
      reply,
    ]);
    setInput("");
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[59] bg-black/10 sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {isOpen && (
        <section
          className="fixed z-[60] bottom-20 right-3 left-3 sm:left-auto sm:right-5 sm:bottom-24 w-auto sm:w-[380px] h-[min(620px,calc(100vh-110px))] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Чат с помощником КардоМатик"
        >
          <header className="flex items-center justify-between gap-3 px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold truncate">Помощник КардоМатик</h2>
                <p className="text-[11px] text-primary-foreground/75">Ответы на частые вопросы</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-primary-foreground/15 transition-colors"
              aria-label="Закрыть чат"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                    message.role === "user"
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-background border border-border text-foreground"
                  }`}
                >
                  <p>{message.text}</p>
                  {message.showSupportLink && (
                    <a
                      href={SUPPORT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
                    >
                      Написать в поддержку <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 1 && (
              <div className="pt-1">
                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">Популярные вопросы</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedQuestions.map((entry) => (
                    <button
                      key={entry.question}
                      type="button"
                      onClick={() => sendQuestion(entry.question)}
                      className="text-left text-[11px] rounded-full border border-border bg-background px-2.5 py-1.5 text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      {entry.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="p-3 border-t border-border bg-background flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendQuestion();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Напишите вопрос..."
              aria-label="Ваш вопрос"
              className="min-w-0 flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Отправить вопрос"
              className="h-9 w-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed z-[60] bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label={isOpen ? "Закрыть чат" : "Открыть чат поддержки"}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}

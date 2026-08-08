import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Generation, GptAnalysis, SeoText } from "@shared/schema";
import ImageEditor from "@/components/image-editor";
import TextEditor from "@/components/text-editor";
import {
  Download,
  Plus,
  CheckCircle2,
  Star,
  ArrowRight,
  Target,
  Copy,
  Check,
  ExternalLink,
  Video,
  Camera,
  Pencil,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";

interface ResultViewProps {
  generation: Generation;
  onNewGeneration: () => void;
  onAnimateVideo?: (imageUrl: string) => void;
  animatingVideo?: boolean;
  onRegenerationComplete?: (id: string) => void;
  isTrial?: boolean;
}

export default function ResultView({ generation, onNewGeneration, onAnimateVideo, animatingVideo, onRegenerationComplete, isTrial = false }: ResultViewProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [starsBalance, setStarsBalance] = useState(0);
  const [hasPaidBalance, setHasPaidBalance] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const analysis = generation.gptAnalysis as GptAnalysis | null;

  const genType = (generation as any).generationType as string | undefined;
  const isVideo = genType === "video";
  const isTryon = genType === "tryon";
  const isCard = !isVideo && !isTryon;

  const mediaUrl = generation.resultImageUrl;
  const canEdit = (isCard || isTryon) && !!mediaUrl;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((user) => {
        if (user) {
          if (typeof user.starsBalance === "number") setStarsBalance(user.starsBalance);
          setHasPaidBalance(Number(user.nano2Balance) > 0 || Number(user.proBalance) > 0);
        }
      })
      .catch(() => {});
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const seoText = (generation.seoText || (analysis ? {
    marketplaceTitle: analysis.title || "Товар для маркетплейса",
    description: analysis.description || "Описание товара для карточки маркетплейса.",
    keywords: analysis.keywords || [],
    benefits: analysis.benefits || [],
    source: "ai-analysis",
  } : null)) as SeoText | null;
  const canCopySeo = hasPaidBalance;
  const canDownloadResult = !isTrial || hasPaidBalance;
  const protectedSeoPreview = seoText
    ? `${seoText.description.slice(0, 30)}${seoText.description.length > 30 ? "…" : ""}`
    : "";

  const handleDownload = async () => {
    if (!mediaUrl) return;
    if (!canDownloadResult) {
      return;
    }
    setDownloading(true);
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(mediaUrl)}`;
      const resp = await fetch(proxyUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const ext = isVideo ? "mp4" : "png";
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `kardomatik-${generation.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } finally {
      setDownloading(false);
    }
  };

  const handleRegenerate = async (updated: GptAnalysis) => {
    setIsRegenerating(true);
    setTextEditorOpen(false);
    try {
      const resp = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, analysis: updated }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Ошибка перегенерации");
      }
      const me = await fetch("/api/auth/me");
      if (me.ok) {
        const user = await me.json();
        if (typeof user.starsBalance === "number") setStarsBalance(user.starsBalance);
      }
      onRegenerationComplete?.(generation.id);
    } catch (err: any) {
      alert(err.message || "Ошибка перегенерации");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Блокировка сочетаний клавиш для сохранения в пробном режиме.
  useEffect(() => {
    if (!isTrial) return;
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", blockKeys);
    return () => document.removeEventListener("keydown", blockKeys);
  }, [isTrial]);

  useEffect(() => {
    if (!isTrial || !mediaUrl || isVideo) return;
    setCanvasReady(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth || 1024;
      canvas.height = img.naturalHeight || 1024;
      ctx.drawImage(img, 0, 0);
      setCanvasReady(true);
    };
    img.onerror = () => {
      setCanvasReady(false);
    };
    // data-URL уже содержит изображение; проксировать через GET-параметр
    // нельзя — длина URL превысит лимиты и браузер не загрузит картинку.
    img.src = mediaUrl.startsWith("data:") ? mediaUrl : `/api/proxy-image?url=${encodeURIComponent(mediaUrl)}`;
  }, [isTrial, mediaUrl, isVideo]);

  const headerTitle = isVideo ? "Видео готово!" : isTryon ? "Примерка готова!" : "Карточка готова!";
  const newLabel = isVideo ? "Новое видео" : isTryon ? "Новая примерка" : "Новая карточка";
  const HeaderIcon = isVideo ? Video : isTryon ? Camera : CheckCircle2;

  return (
    <>
      {editorOpen && mediaUrl && (
        <ImageEditor
          imageUrl={mediaUrl}
          aspectRatio={generation.aspectRatio || "1:1"}
          onClose={() => setEditorOpen(false)}
          stars={starsBalance}
          onStarsChange={setStarsBalance}
          isTrial={isTrial}
        />
      )}
      {textEditorOpen && analysis && (
        <TextEditor
          analysis={analysis}
          onClose={() => setTextEditorOpen(false)}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />
      )}

      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <HeaderIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground">{headerTitle}</span>
              {!isVideo && !isTryon && generation.aspectRatio && (
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  {generation.aspectRatio}
                </Badge>
              )}
              {isTrial && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-500/10">
                  Пробная версия
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditorOpen(true)}
                  data-testid="button-edit"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Редактировать
                </Button>
              )}
              {!isTrial && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(mediaUrl!, "_blank")}
                  data-testid="button-open"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Открыть
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                 disabled={downloading || !canDownloadResult}
                data-testid="button-download"
                 title={!canDownloadResult ? "Скачивание доступно только для оплаченных пакетов" : undefined}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {downloading ? "Скачиваем..." : "Скачать"}
              </Button>
              <Button
                size="sm"
                onClick={onNewGeneration}
                data-testid="button-new-generation"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {newLabel}
              </Button>
            </div>
          </div>

          <div className="p-4">
            <div
              className="relative rounded-lg overflow-hidden bg-muted flex items-center justify-center"
              style={{ minHeight: 320, userSelect: "none" }}
              onContextMenu={isTrial ? (e) => e.preventDefault() : undefined}
              onDragStart={isTrial ? (e) => e.preventDefault() : undefined}
            >
              {mediaUrl ? (
                isVideo ? (
                  <video
                    src={mediaUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full max-h-[520px] object-contain"
                    data-testid="video-result"
                  />
                ) : isTrial ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      className="w-full object-contain max-h-[520px]"
                      style={{ display: canvasReady ? "block" : "none" }}
                      onContextMenu={(e) => e.preventDefault()}
                      data-testid="img-result"
                    />
                    {!canvasReady && (
                      <div className="w-full flex items-center justify-center py-16 text-sm text-muted-foreground">
                        Загрузка изображения...
                      </div>
                    )}
                  </>
                ) : (
                  <img
                    src={mediaUrl}
                    alt={isTryon ? "Примерка одежды" : "Готовая карточка товара"}
                    className="w-full h-full object-contain max-h-[520px]"
                    data-testid="img-result"
                  />
                )
              ) : (
                <div className="text-center text-muted-foreground text-sm p-8">
                  {isVideo ? "Видео загружается..." : "Изображение загружается..."}
                </div>
              )}
            </div>

            {isTrial && (
              <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700">Пробная версия с водяным знаком</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Зарегистрируйтесь и купите пакет — получите карточку без водяного знака и возможность скачать.
                  </p>
                  <Link href="/pricing">
                    <button className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2">
                      Купить пакет →
                    </button>
                  </Link>
                </div>
              </div>
            )}
            {isTryon && generation.processingNotice && (
              <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
                {generation.processingNotice}
              </div>
            )}
          </div>
        </Card>

        {analysis && !isVideo && !isTryon && (
          <Card className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-foreground">Маркетинговый анализ GPT-4o</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTextEditorOpen(true)}
                disabled={isRegenerating}
                data-testid="button-edit-text"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {isRegenerating ? "Генерация..." : "Изменить текст"}
              </Button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Название</p>
                <button
                  onClick={() => copyToClipboard(analysis.title, "title")}
                  className="flex items-center gap-1 text-xs text-muted-foreground px-1.5 py-0.5 rounded-sm hover:bg-muted transition-colors"
                  data-testid="button-copy-title"
                >
                  {copiedField === "title" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-base font-bold text-foreground" data-testid="text-title">{analysis.title}</p>
            </div>

            <Separator />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Описание</p>
                <button
                  onClick={() => copyToClipboard(analysis.description, "desc")}
                  className="flex items-center gap-1 text-xs text-muted-foreground px-1.5 py-0.5 rounded-sm hover:bg-muted transition-colors"
                  data-testid="button-copy-desc"
                >
                  {copiedField === "desc" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-sm text-foreground leading-relaxed" data-testid="text-description">{analysis.description}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Преимущества</p>
              <div className="space-y-2">
                {analysis.benefits?.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Star className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5 fill-current" />
                    <p className="text-sm text-foreground" data-testid={`text-benefit-${i}`}>{benefit}</p>
                  </div>
                ))}
              </div>
            </div>

            {!!analysis.characteristics?.length && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Характеристики</p>
                  <div className="space-y-1">
                    {analysis.characteristics.map((item, i) => (
                      <p key={i} className="text-sm text-foreground" data-testid={`text-characteristic-${i}`}>• {item}</p>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!!analysis.useCases?.length && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Для кого и зачем</p>
                  <div className="space-y-1">
                    {analysis.useCases.map((item, i) => (
                      <p key={i} className="text-sm text-foreground" data-testid={`text-use-case-${i}`}>• {item}</p>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!!analysis.keywords?.length && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">SEO-ключи</p>
                  <p className="text-sm text-foreground" data-testid="text-keywords">{analysis.keywords.join(", ")}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Призыв к действию</p>
                <p className="text-sm font-semibold text-foreground" data-testid="text-cta">{analysis.callToAction}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
            </div>
          </Card>
        )}

        {seoText && isCard && (
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setSeoOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
              aria-expanded={seoOpen}
              data-testid="button-toggle-seo"
            >
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Target className="w-4 h-4 text-primary" />
                SEO-оптимизация для маркетплейсов
              </span>
              <span className="text-xs text-muted-foreground">{seoOpen ? "Свернуть" : "Раскрыть"}</span>
            </button>
            {seoOpen && (
              <div className="border-t border-border p-4 space-y-4">
                {!canCopySeo ? (
                  <div
                    className="relative rounded-lg border border-amber-300/60 bg-amber-500/5 p-3 select-none"
                    onContextMenu={(event) => event.preventDefault()}
                    onCopy={(event) => event.preventDefault()}
                    onCut={(event) => event.preventDefault()}
                    onDragStart={(event) => event.preventDefault()}
                  >
                    <p className="text-sm text-foreground/80 blur-[1px]">{protectedSeoPreview}</p>
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/75 px-4 text-center backdrop-blur-[1px]">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        SEO-текст защищён от копирования в пробной версии. Купите пакет для полного доступа.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <SeoField label="Заголовок для маркетплейса" value={seoText.marketplaceTitle} onCopy={() => copyToClipboard(seoText.marketplaceTitle, "seo-title")} copied={copiedField === "seo-title"} />
                    <SeoField label="Описание товара" value={seoText.description} onCopy={() => copyToClipboard(seoText.description, "seo-description")} copied={copiedField === "seo-description"} />
                    <SeoField label="Ключевые слова" value={seoText.keywords.join(", ")} onCopy={() => copyToClipboard(seoText.keywords.join(", "), "seo-keywords")} copied={copiedField === "seo-keywords"} />
                    <SeoField label="Преимущества" value={seoText.benefits.map((benefit) => `• ${benefit}`).join("\n")} onCopy={() => copyToClipboard(seoText.benefits.join("\n"), "seo-benefits")} copied={copiedField === "seo-benefits"} />
                  </>
                )}
                {seoText.source === "template" && (
                  <p className="text-xs text-muted-foreground">AI-текст недоступен, поэтому показан шаблонный вариант. Его можно уточнить после добавления информации о товаре.</p>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function SeoField({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 text-xs text-muted-foreground px-1.5 py-0.5 rounded-sm hover:bg-muted transition-colors"
          data-testid={`button-copy-seo-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

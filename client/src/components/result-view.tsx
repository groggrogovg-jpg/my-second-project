import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Generation, GptAnalysis } from "@shared/schema";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const analysis = generation.gptAnalysis as GptAnalysis | null;

  const genType = (generation as any).generationType as string | undefined;
  const isVideo = genType === "video";
  const isTryon = genType === "tryon";
  const isCard = !isVideo && !isTryon;

  const mediaUrl = generation.resultImageUrl;
  const canEdit = (isCard || isTryon) && !!mediaUrl;

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownload = async () => {
    if (!mediaUrl) return;
    if (isTrial) {
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
      onRegenerationComplete?.(generation.id);
    } catch (err: any) {
      alert(err.message || "Ошибка перегенерации");
    } finally {
      setIsRegenerating(false);
    }
  };

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
      const size = Math.min(canvas.width, canvas.height);
      const fontSize = Math.round(size * 0.075);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 6;
      ctx.fillText("КардоМатик", 0, 0);
      ctx.restore();
      setCanvasReady(true);
    };
    img.onerror = () => setCanvasReady(false);
    img.src = `/api/proxy-image?url=${encodeURIComponent(mediaUrl)}`;
  }, [isTrial, mediaUrl, isVideo]);

  const headerTitle = isVideo ? "Видео готово!" : isTryon ? "Примерка готова!" : "Карточка готова!";
  const newLabel = isVideo ? "Новое видео" : isTryon ? "Новая примерка" : "Новая карточка";
  const HeaderIcon = isVideo ? Video : isTryon ? Camera : CheckCircle2;

  return (
    <>
      {editorOpen && mediaUrl && (
        <ImageEditor imageUrl={mediaUrl} onClose={() => setEditorOpen(false)} stars={0} onStarsChange={() => {}} />
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
              {canEdit && !isTrial && (
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
                disabled={downloading || isTrial}
                data-testid="button-download"
                title={isTrial ? "Скачивание доступно только для оплаченных пакетов" : undefined}
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
            <div className="relative rounded-lg overflow-hidden bg-muted flex items-center justify-center" style={{ minHeight: 320 }}>
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
      </div>
    </>
  );
}

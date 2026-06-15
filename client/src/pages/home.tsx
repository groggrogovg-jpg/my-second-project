import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import GenerationCard from "@/components/generation-card";
import ResultView from "@/components/result-view";
import {
  Sparkles, History, Zap, Star,
  CreditCard, Loader2, RefreshCw, Camera, Type, Video,
  ImagePlus, X, ChevronDown, ChevronUp, Info, Target,
  CheckSquare, Square, Gift, Check,
} from "lucide-react";
import type { Generation } from "@shared/schema";
import { MODELS, ASPECT_RATIOS, INITIAL_STARS, starsToGenerations, VIDEO_STAR_COSTS, TRYON_STAR_COST, type ModelId, type AspectRatioId } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Категории одежды для примерки
type GarmentCategory = "head" | "top" | "bottom" | "feet" | "extra";
const GARMENT_CATEGORIES: { id: GarmentCategory; label: string; examples: string }[] = [
  { id: "head", label: "Голова / аксессуары", examples: "Шапка, кепка, очки, шарф, берет" },
  { id: "top", label: "Верх", examples: "Футболка, пиджак, рубашка, платье, свитер" },
  { id: "bottom", label: "Низ", examples: "Штаны, юбка, колготки, джинсы, шорты" },
  { id: "feet", label: "Ноги", examples: "Ботинки, кроссовки, кеды, сапоги, сандалии" },
  { id: "extra", label: "Дополнительно", examples: "Сумка, ремень, часы, бижутерия, пальто" },
];

const STARS_KEY = "kardo_stars";
const USED_PROMOS_KEY = "kardo_used_promos";

function getUsedPromos(): string[] {
  try { return JSON.parse(localStorage.getItem(USED_PROMOS_KEY) || "[]"); } catch { return []; }
}
function markPromoUsed(code: string) {
  const used = getUsedPromos();
  if (!used.includes(code)) localStorage.setItem(USED_PROMOS_KEY, JSON.stringify([...used, code]));
}

function getStars(): number {
  const stored = localStorage.getItem(STARS_KEY);
  if (stored === null) {
    localStorage.setItem(STARS_KEY, String(INITIAL_STARS));
    return INITIAL_STARS;
  }
  return parseInt(stored, 10) || 0;
}

function setStarsStorage(n: number) {
  localStorage.setItem(STARS_KEY, String(Math.max(0, n)));
}

type ContentTab = "photo" | "card";
type VideoDuration = 5 | 10;
type FormatId = "8:16" | "3:4" | "1:1" | "4:5" | "16:9";

const FORMATS: { id: FormatId; label: string }[] = [
  { id: "8:16", label: "8:16" },
  { id: "3:4", label: "3:4" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "16:9", label: "16:9" },
];

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>("nano-banana-pro");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioId>("1:1");
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);
  const [stars, setStars] = useState<number>(getStars);
  const pendingStarCostRef = useRef<number>(0);
  const [pendingPaymentLabel, setPendingPaymentLabel] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const promoInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ContentTab>("card");
  const [selectedFormat, setSelectedFormat] = useState<FormatId>("1:1");
  const [creativity, setCreativity] = useState(50);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [videoDuration, setVideoDuration] = useState<VideoDuration>(5);
  const [videoLooping, setVideoLooping] = useState(false);
  const [videoCardMode, setVideoCardMode] = useState(false);
  const [videoDesc, setVideoDesc] = useState("");
  const [tryonGarments, setTryonGarments] = useState<Record<GarmentCategory, { file: File | null; url: string | null }>>({
    head: { file: null, url: null },
    top: { file: null, url: null },
    bottom: { file: null, url: null },
    feet: { file: null, url: null },
    extra: { file: null, url: null },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStars = (n: number) => {
    setStarsStorage(n);
    setStars(Math.max(0, n));
  };

  const redeemPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (getUsedPromos().includes(code)) {
      toast({ title: "Промокод уже использован", variant: "destructive" });
      return;
    }
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Неверный промокод", variant: "destructive" });
      } else {
        markPromoUsed(code);
        updateStars(getStars() + data.stars);
        toast({ title: data.message, description: `Баланс: ${getStars() + data.stars} ⭐` });
        setPromoCode("");
        setPromoOpen(false);
      }
    } catch {
      toast({ title: "Ошибка сети", variant: "destructive" });
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STARS_KEY && e.newValue !== null) {
        setStars(parseInt(e.newValue, 10) || 0);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const pending = localStorage.getItem("kardo_pending_payment");
    if (!pending) return;
    let parsed: { label: string; stars: number };
    try { parsed = JSON.parse(pending); } catch { return; }
    const { label, stars: starsToAdd } = parsed;
    const creditedKey = `kardo_credited_${label}`;
    if (localStorage.getItem(creditedKey)) {
      localStorage.removeItem("kardo_pending_payment");
      return;
    }
    setPendingPaymentLabel(label);
    let attempts = 0;
    const maxAttempts = 24;

    const creditStars = (amount: number) => {
      const newStars = getStars() + amount;
      updateStars(newStars);
      localStorage.setItem(creditedKey, "1");
      localStorage.removeItem("kardo_pending_payment");
      setPendingPaymentLabel(null);
      toast({ title: `+${amount} ⭐ зачислено!`, description: "Звёзды добавлены на ваш баланс. Приятной работы!" });
    };

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/payment/verify?label=${encodeURIComponent(label)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.paid) { clearInterval(interval); creditStars(data.stars || starsToAdd); return; }
          if (data.tokenExpired) { clearInterval(interval); return; }
        } else {
          const res2 = await fetch(`/api/payment/pending?label=${encodeURIComponent(label)}`);
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.found && data2.confirmed) { clearInterval(interval); creditStars(data2.stars || starsToAdd); return; }
          }
        }
      } catch {}
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { data: generations = [] } = useQuery<Generation[]>({
    queryKey: ["/api/generations"],
    refetchInterval: 5000,
  });

  const { data: polledGeneration } = useQuery<Generation>({
    queryKey: ["/api/generation", activeGenerationId],
    enabled: !!activeGenerationId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      return data.status === "done" || data.status === "error" ? false : 3000;
    },
    queryFn: async () => {
      const res = await fetch(`/api/generation/${activeGenerationId}`);
      if (!res.ok) throw new Error("Ошибка загрузки");
      const data = await res.json();
      if (data.status === "done" || data.status === "error") {
        queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      }
      return data;
    },
  });

  // При перегенерации очищаем кэш поллинга, чтобы перезапустить опрос
  const handleRegenerationComplete = useCallback((id: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/generation", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
  }, [queryClient]);

  const activeGeneration = activeGenerationId
    ? (polledGeneration ?? generations.find((g) => g.id === activeGenerationId) ?? null)
    : null;

  useEffect(() => {
    if (!activeGenerationId && generations.length > 0) {
      const inProgress = generations.find(
        (g) => g.status === "generating" || g.status === "analyzing" || g.status === "uploading"
      );
      if (inProgress) setActiveGenerationId(inProgress.id);
    }
  }, [generations, activeGenerationId]);

  useEffect(() => {
    if (!polledGeneration) return;
    if (polledGeneration.status === "done" && pendingStarCostRef.current > 0) {
      updateStars(getStars() - pendingStarCostRef.current);
      pendingStarCostRef.current = 0;
    }
    if (polledGeneration.status === "error" && pendingStarCostRef.current > 0) {
      pendingStarCostRef.current = 0;
      toast({
        title: "Ошибка генерации",
        description: polledGeneration.errorMessage || "Не удалось создать карточку. Звёзды не списаны.",
        variant: "destructive",
      });
    }
  }, [polledGeneration?.status]);

  const currentModel = MODELS.find((m) => m.id === selectedModel)!;
  const videoStars = VIDEO_STAR_COSTS[videoDuration];

  const hasAnyGarment = Object.values(tryonGarments).some((g) => g.file !== null);
  const canGenerate =
    activeTab === "card" ? (stars >= currentModel.stars && selectedFiles.length > 0) :
    activeTab === "photo" ? (stars >= TRYON_STAR_COST && selectedFiles.length > 0 && hasAnyGarment) :
    false;

  const cardMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model", selectedModel);
      formData.append("aspectRatio", selectedAspectRatio);
      if (notes.trim()) formData.append("notes", notes.trim());
      const response = await fetch("/api/generate", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        let msg = "Ошибка";
        try { msg = JSON.parse(text)?.error || msg; } catch {}
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: (data) => {
      pendingStarCostRef.current = currentModel.stars;
      setActiveGenerationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка запуска", description: err.message, variant: "destructive" });
    },
  });

  const videoMutation = useMutation({
    mutationFn: async ({ file, duration, prompt }: { file: File; duration: number; prompt: string }) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("duration", String(duration));
      if (prompt.trim()) formData.append("prompt", prompt.trim());
      const response = await fetch("/api/generate-video", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        let msg = "Ошибка";
        try { msg = JSON.parse(text)?.error || msg; } catch {}
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: (data) => {
      pendingStarCostRef.current = VIDEO_STAR_COSTS[videoDuration];
      setActiveGenerationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка запуска видео", description: err.message, variant: "destructive" });
    },
  });

  const tryonMutation = useMutation({
    mutationFn: async ({ personFile, garmentFiles }: { personFile: File; garmentFiles: File[] }) => {
      const formData = new FormData();
      formData.append("person", personFile);
      garmentFiles.forEach((f) => formData.append("garment", f));
      const response = await fetch("/api/generate-tryon", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        let msg = "Ошибка";
        try { msg = JSON.parse(text)?.error || msg; } catch {}
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: (data) => {
      pendingStarCostRef.current = TRYON_STAR_COST;
      setActiveGenerationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка примерки", description: err.message, variant: "destructive" });
    },
  });

  const handleFilesAdd = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 4 - selectedFiles.length);
    if (!arr.length) return;
    const newFiles = [...selectedFiles, ...arr].slice(0, 4);
    const newUrls = newFiles.map((f, i) => previewUrls[i] ?? URL.createObjectURL(f));
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
  }, [selectedFiles, previewUrls]);

  const handleRemoveFile = (idx: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== idx);
    const newUrls = previewUrls.filter((_, i) => i !== idx);
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFilesAdd(e.dataTransfer.files);
  }, [handleFilesAdd]);

  const handleGenerate = () => {
    if (!canGenerate) return;
    if (activeTab === "photo") {
      if (!selectedFiles[0]) return;
      const garmentFiles = Object.values(tryonGarments)
        .map((g) => g.file)
        .filter(Boolean) as File[];
      if (garmentFiles.length === 0) return;
      tryonMutation.mutate({ personFile: selectedFiles[0], garmentFiles });
    } else {
      if (!selectedFiles[0]) return;
      cardMutation.mutate(selectedFiles[0]);
    }
  };

  const handleNewGeneration = () => {
    setActiveGenerationId(null);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setNotes("");
  };

  const [animatingVideo, setAnimatingVideo] = useState(false);

  const handleAnimateVideo = async (imageUrl: string) => {
    if (animatingVideo) return;
    const cost = VIDEO_STAR_COSTS[5];
    if (stars < cost) {
      toast({ title: "Недостаточно звёзд", description: `Нужно ${cost} ⭐ для оживления`, variant: "destructive" });
      return;
    }
    setAnimatingVideo(true);
    try {
      let blob: Blob;
      if (imageUrl.startsWith("data:")) {
        const [header, base64] = imageUrl.split(",");
        const mime = header.match(/:(.*?);/)?.[1] || "image/png";
        const binary = atob(base64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`);
        blob = await resp.blob();
      }
      const file = new File([blob], "tryon-result.png", { type: blob.type || "image/png" });
      const formData = new FormData();
      formData.append("image", file);
      formData.append("duration", "5");
      formData.append("prompt", "Smooth model showcase, slow graceful movement, professional fashion shoot lighting, cinematic quality");
      const response = await fetch("/api/generate-video", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        let msg = "Ошибка запуска видео";
        try { msg = JSON.parse(text)?.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await response.json();
      pendingStarCostRef.current = cost;
      setActiveGenerationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({ title: "Видео запущено!", description: "Оживление карточки началось ⭐×5" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setAnimatingVideo(false);
    }
  };

  const handleSelectHistory = (gen: Generation) => {
    setActiveGenerationId(gen.id);
    setSelectedFiles([]);
    setPreviewUrls([]);
  };

  const isDone = activeGeneration?.status === "done";
  const isProcessing = activeGeneration && !["done", "error"].includes(activeGeneration.status ?? "");
  const isError = activeGeneration?.status === "error";

  const formatToAspect: Record<FormatId, AspectRatioId> = {
    "8:16": "9:16",
    "3:4": "3:4",
    "1:1": "1:1",
    "4:5": "4:5",
    "16:9": "4:3",
  };

  const handleFormatSelect = (f: FormatId) => {
    setSelectedFormat(f);
    const mapped = formatToAspect[f];
    if (mapped) setSelectedAspectRatio(mapped);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-foreground tracking-tight">КардоМатик</h1>
              <p className="text-xs text-muted-foreground leading-none">ИИ-генератор карточек товаров</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <button
                className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
                data-testid="link-pricing"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Тарифы
              </button>
            </Link>
            {promoOpen ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={promoInputRef}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") redeemPromo(); if (e.key === "Escape") { setPromoOpen(false); setPromoCode(""); } }}
                  placeholder="Введите промокод"
                  className="h-8 w-36 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  data-testid="input-promo-code"
                />
                <button
                  onClick={redeemPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                  data-testid="button-promo-submit"
                >
                  {promoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => { setPromoOpen(false); setPromoCode(""); }}
                  className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                  data-testid="button-promo-close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setPromoOpen(true); setTimeout(() => promoInputRef.current?.focus(), 50); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
                data-testid="button-promo-open"
              >
                <Gift className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Промокод</span>
              </button>
            )}
            <StarBalance stars={stars} />
          </div>
        </div>
      </header>

      {pendingPaymentLabel && (
        <div className="border-b border-amber-500/30 bg-amber-500/5">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              {verifyingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4 fill-amber-500 text-amber-500" />}
              <span>Платёж в обработке — звёзды будут зачислены автоматически</span>
            </div>
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
              data-testid="button-verify-payment"
              disabled={verifyingPayment}
              onClick={async () => {
                if (!pendingPaymentLabel) return;
                setVerifyingPayment(true);
                try {
                  const res = await fetch(`/api/payment/verify?label=${encodeURIComponent(pendingPaymentLabel)}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.paid) {
                      const pending = localStorage.getItem("kardo_pending_payment");
                      let starsToAdd = data.stars;
                      if (!starsToAdd && pending) { try { starsToAdd = JSON.parse(pending).stars; } catch {} }
                      const creditedKey = `kardo_credited_${pendingPaymentLabel}`;
                      updateStars(getStars() + starsToAdd);
                      localStorage.setItem(creditedKey, "1");
                      localStorage.removeItem("kardo_pending_payment");
                      setPendingPaymentLabel(null);
                      toast({ title: `+${starsToAdd} ⭐ зачислено!`, description: "Спасибо за покупку!" });
                      return;
                    }
                    if (data.tokenExpired) {
                      toast({ title: "Проверка недоступна", description: "Обратитесь к администратору сервиса.", variant: "destructive" });
                      return;
                    }
                  }
                  toast({ title: "Платёж ещё не подтверждён", description: "Попробуйте через несколько минут." });
                } catch {
                  toast({ title: "Ошибка проверки", description: "Попробуйте позже.", variant: "destructive" });
                } finally {
                  setVerifyingPayment(false);
                }
              }}
            >
              <RefreshCw className="w-3 h-3" />
              Проверить сейчас
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
          <div className="w-full lg:w-[340px] flex-shrink-0 space-y-3">
            <PhotoBlock
              selectedFiles={selectedFiles}
              previewUrls={previewUrls}
              onFilesAdd={handleFilesAdd}
              onRemove={handleRemoveFile}
              onDrop={handleDrop}
              fileInputRef={fileInputRef}
            />

            <GenerateBlock
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              notes={notes}
              setNotes={setNotes}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              selectedFormat={selectedFormat}
              handleFormatSelect={handleFormatSelect}
              creativity={creativity}
              setCreativity={setCreativity}
              advancedOpen={advancedOpen}
              setAdvancedOpen={setAdvancedOpen}
              videoDuration={videoDuration}
              setVideoDuration={setVideoDuration}
              videoLooping={videoLooping}
              setVideoLooping={setVideoLooping}
              videoCardMode={videoCardMode}
              setVideoCardMode={setVideoCardMode}
              videoDesc={videoDesc}
              setVideoDesc={setVideoDesc}
              tryonGarments={tryonGarments}
              setTryonGarments={setTryonGarments}
              stars={stars}
              canGenerate={canGenerate}
              currentModel={currentModel}
              videoStars={videoStars}
              isPending={cardMutation.isPending || videoMutation.isPending || tryonMutation.isPending}
              hasFiles={selectedFiles.length > 0}
              selectedFiles={selectedFiles}
              onGenerate={handleGenerate}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <ResultsPanel
              isDone={isDone}
              isProcessing={!!isProcessing}
              isError={!!isError}
              activeGeneration={activeGeneration}
              onNewGeneration={handleNewGeneration}
              onAnimateVideo={handleAnimateVideo}
              animatingVideo={animatingVideo}
              onRegenerationComplete={handleRegenerationComplete}
              stars={stars}
              onStarsChange={updateStars}
            />

            {generations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">История</span>
                  <Badge variant="secondary" className="text-xs ml-auto">{generations.length}</Badge>
                </div>
                <div className="space-y-2">
                  {generations.map((gen) => (
                    <GenerationCard
                      key={gen.id}
                      generation={gen}
                      isActive={gen.id === activeGenerationId}
                      onClick={() => handleSelectHistory(gen)}
                    />
                  ))}
                </div>
                <Separator />
              </div>
            )}

            <Link href="/pricing">
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/3 transition-all text-sm group" data-testid="link-pricing-card">
                <div className="text-left">
                  <p className="font-medium text-foreground">Тарифы</p>
                  <p className="text-xs text-muted-foreground">Пакеты и подписки</p>
                </div>
                <CreditCard className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function PhotoBlock({
  selectedFiles, previewUrls, onFilesAdd, onRemove, onDrop, fileInputRef,
}: {
  selectedFiles: File[];
  previewUrls: string[];
  onFilesAdd: (files: FileList | File[]) => void;
  onRemove: (idx: number) => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Ваш товар</span>
        <span className="text-2xl font-bold text-muted-foreground/30 leading-none">01</span>
      </div>

      {selectedFiles.length === 0 ? (
        <div
          className={`rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center py-8 sm:py-10 px-3 sm:px-4 cursor-pointer ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/20"
          }`}
          onDrop={(e) => { setDragging(false); onDrop(e); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          data-testid="upload-zone"
        >
          <ImagePlus className="w-8 h-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground mb-0.5">Перетащите фото сюда</p>
          <p className="text-xs text-muted-foreground">или <span className="text-primary font-medium">выберите файл</span></p>
          <p className="text-xs text-muted-foreground mt-4">До 4 фото товара с разных сторон</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {previewUrls.map((url, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden bg-muted group">
                <img src={url} alt={`Фото ${i + 1}`} className="w-full h-auto max-h-48 object-contain" data-testid={`preview-${i}`} />
                <button
                  onClick={() => onRemove(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`remove-photo-${i}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {selectedFiles.length < 4 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 flex flex-col items-center justify-center gap-1 transition-colors py-8"
                data-testid="add-photo-btn"
              >
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Добавить</span>
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {selectedFiles.length} из 4 фото · <button className="text-primary hover:underline" onClick={() => fileInputRef.current?.click()}>добавить ещё</button>
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="input-file"
        onChange={(e) => { if (e.target.files) { onFilesAdd(e.target.files); e.target.value = ""; } }}
      />
    </Card>
  );
}

function GenerateBlock({
  activeTab, setActiveTab,
  notes, setNotes,
  selectedModel, setSelectedModel,
  selectedFormat, handleFormatSelect,
  creativity, setCreativity,
  advancedOpen, setAdvancedOpen,
  videoDuration, setVideoDuration,
  videoLooping, setVideoLooping,
  videoCardMode, setVideoCardMode,
  videoDesc, setVideoDesc,
  tryonGarments, setTryonGarments,
  stars, canGenerate, currentModel, videoStars, isPending, hasFiles,
  selectedFiles,
  onGenerate,
}: {
  activeTab: ContentTab; setActiveTab: (t: ContentTab) => void;
  notes: string; setNotes: (v: string) => void;
  selectedModel: ModelId; setSelectedModel: (m: ModelId) => void;
  selectedFormat: FormatId; handleFormatSelect: (f: FormatId) => void;
  creativity: number; setCreativity: (v: number) => void;
  advancedOpen: boolean; setAdvancedOpen: (v: boolean) => void;
  videoDuration: VideoDuration; setVideoDuration: (v: VideoDuration) => void;
  videoLooping: boolean; setVideoLooping: (v: boolean) => void;
  videoCardMode: boolean; setVideoCardMode: (v: boolean) => void;
  videoDesc: string; setVideoDesc: (v: string) => void;
  tryonGarments: Record<GarmentCategory, { file: File | null; url: string | null }>;
  setTryonGarments: React.Dispatch<React.SetStateAction<Record<GarmentCategory, { file: File | null; url: string | null }>>>;
  stars: number; canGenerate: boolean;
  currentModel: typeof MODELS[number];
  videoStars: number;
  isPending: boolean; hasFiles: boolean;
  selectedFiles: File[];
  onGenerate: () => void;
}) {
  const hasAnyGarment = Object.values(tryonGarments).some((g) => g.file !== null);

  const tabs: { id: ContentTab; label: string; icon: React.ReactNode }[] = [
    { id: "photo", label: "Фото", icon: <Camera className="w-3.5 h-3.5" /> },
    { id: "card", label: "Карточка", icon: <Type className="w-3.5 h-3.5" /> },
  ];

  const tabDesc: Record<ContentTab, string> = {
    photo: "Виртуальная примерка одежды на модель",
    card: "Готовые карточки товара с инфографикой и текстом",
  };

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Настройте генерацию</span>
        <span className="text-2xl font-bold text-muted-foreground/30 leading-none">02</span>
      </div>

      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Тип контента</p>
        <div className="flex gap-1.5 p-1 bg-muted rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                activeTab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label === "Фото" ? "Примерка" : "Карточка"}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{tabDesc[activeTab]}</p>
      </div>

      <Separator className="mb-3" />

      {activeTab === "card" && (
        <CardTabContent
          notes={notes}
          setNotes={setNotes}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          stars={stars}
          selectedFiles={selectedFiles}
        />
      )}

      {activeTab === "photo" && (
        <TryonTabContent
          tryonGarments={tryonGarments}
          setTryonGarments={setTryonGarments}
          hasPersonPhoto={hasFiles}
        />
      )}

      <div className="mt-4">
        {activeTab === "card" && !hasFiles && (
          <p className="text-xs text-muted-foreground text-center mb-2">Сначала загрузите фото товара</p>
        )}
        {activeTab === "photo" && !hasFiles && (
          <p className="text-xs text-muted-foreground text-center mb-2">Загрузите фото модели в блоке выше</p>
        )}
        {activeTab === "photo" && hasFiles && !hasAnyGarment && (
          <p className="text-xs text-muted-foreground text-center mb-2">Загрузите фото одежды ниже</p>
        )}
        {activeTab === "card" && hasFiles && stars < currentModel.stars && (
          <p className="text-xs text-destructive text-center mb-2">
            Недостаточно звёзд. Нужно {currentModel.stars} ⭐, у вас {stars} ⭐
          </p>
        )}
        {activeTab === "photo" && hasFiles && hasAnyGarment && stars < TRYON_STAR_COST && (
          <p className="text-xs text-destructive text-center mb-2">
            Недостаточно звёзд. Нужно {TRYON_STAR_COST} ⭐, у вас {stars} ⭐
          </p>
        )}
        <Button
          className="w-full font-semibold"
          size="lg"
          onClick={canGenerate && !isPending ? onGenerate : undefined}
          disabled={isPending || !canGenerate}
          data-testid="button-generate"
        >
          {isPending ? (
            <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />Запускаем...</>
          ) : stars === 0 ? (
            <Link href="/pricing" className="flex items-center gap-2 w-full justify-center"><Star className="w-4 h-4" />Пополнить звёзды</Link>
          ) : activeTab === "photo" ? (
            <><Sparkles className="w-4 h-4 mr-2" />{hasFiles && hasAnyGarment ? `Примерить · ${TRYON_STAR_COST} ⭐` : "Загрузите фото и одежду"}</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />{hasFiles ? `Создать карточку · ${currentModel.stars} ⭐` : "Загрузите фото"}</>
          )}
        </Button>
      </div>
    </Card>
  );
}

function CardTabContent({
  notes, setNotes, selectedModel, setSelectedModel, stars,
  selectedFiles,
}: {
  notes: string; setNotes: (v: string) => void;
  selectedModel: ModelId; setSelectedModel: (m: ModelId) => void;
  stars: number;
  selectedFiles: File[];
}) {
  const [suggesting, setSuggesting] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    if (!selectedFiles[0]) {
      toast({ title: "Сначала загрузите фото товара", variant: "destructive" });
      return;
    }
    setSuggesting(true);
    try {
      const fd = new FormData();
      fd.append("image", selectedFiles[0]);
      const res = await fetch("/api/suggest-notes", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Ошибка сервера");
      const data = await res.json();
      setNotes(data.notes || "");
      toast({ title: "Готово! Текст вставлен — можете отредактировать" });
    } catch (err: any) {
      toast({ title: "Ошибка AI-идеи", description: err.message, variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-foreground">О чём рассказать</p>
          <button
            onClick={handleSuggest}
            disabled={suggesting || !selectedFiles[0]}
            className="flex items-center gap-1 text-xs text-primary font-medium opacity-70 hover:opacity-100 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-suggest-notes"
          >
            {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI идея
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-1.5">Напишите в свободной форме, какой текст хотите видеть на карточке (преимущества или качества товара)</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Например: натуральный состав, приятный запах, быстрый эффект..."
          rows={3}
          className="resize-none text-sm"
          data-testid="input-notes"
        />
      </div>

      <ModelPills selected={selectedModel} onChange={setSelectedModel} stars={stars} />
    </div>
  );
}

function TryonTabContent({
  tryonGarments, setTryonGarments, hasPersonPhoto,
}: {
  tryonGarments: Record<GarmentCategory, { file: File | null; url: string | null }>;
  setTryonGarments: React.Dispatch<React.SetStateAction<Record<GarmentCategory, { file: File | null; url: string | null }>>>;
  hasPersonPhoto: boolean;
}) {
  const activeRef = useRef<GarmentCategory | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGarmentSelect = (files: FileList | null) => {
    if (!files || !files[0] || !activeRef.current) return;
    const file = files[0];
    const cat = activeRef.current;
    setTryonGarments((prev) => ({
      ...prev,
      [cat]: { file, url: URL.createObjectURL(file) },
    }));
  };

  const removeGarment = (cat: GarmentCategory) => {
    setTryonGarments((prev) => ({ ...prev, [cat]: { file: null, url: null } }));
  };

  const openPicker = (cat: GarmentCategory) => {
    activeRef.current = cat;
    fileInputRef.current?.click();
  };

  const hasAnyGarment = Object.values(tryonGarments).some((g) => g.file !== null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-foreground">Как это работает</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          1. Загрузите фото <span className="font-medium text-foreground">модели</span> в блоке «Ваш товар»<br/>
          2. Загрузите фото <span className="font-medium text-foreground">одежды</span> по категориям ниже<br/>
          3. ИИ виртуально примеряет весь образ на модели
        </p>
        <p className="text-xs text-muted-foreground/70 italic">
          Можно загрузить 1–5 элементов одежды — ИИ соберёт полный образ
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">1. Модель человека</p>
          <span className={`text-xs px-1.5 py-0.5 rounded ${hasPersonPhoto ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
            {hasPersonPhoto ? "✓ Загружено" : "Блок выше ↑"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Загрузите фото модели в блоке «Ваш товар» вверху страницы</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">2. Одежда</p>
          <span className="text-xs text-muted-foreground">
            {Object.values(tryonGarments).filter(g => g.file).length} / 5 вещей
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { handleGarmentSelect(e.target.files); e.target.value = ""; }}
        />

        <div className="space-y-3">
          {GARMENT_CATEGORIES.map((cat) => {
            const garment = tryonGarments[cat.id];
            return (
              <div key={cat.id}>
                <p className="text-xs font-medium text-foreground mb-1">{cat.label}</p>
                {garment.url ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={garment.url} alt={cat.label} className="w-full max-h-32 object-contain rounded-lg" />
                    <button
                      onClick={() => removeGarment(cat.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      data-testid={`button-remove-garment-${cat.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openPicker(cat.id)}
                    className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors py-3 flex flex-col items-center gap-1"
                    data-testid={`button-upload-garment-${cat.id}`}
                  >
                    <ImagePlus className="w-5 h-5 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground">{cat.examples}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="bg-muted rounded px-2 py-0.5 font-medium text-foreground">Nano Banana 2</span>
        <span>{hasAnyGarment ? `${Object.values(tryonGarments).filter(g => g.file).length} / 5 элементов` : "— ИИ-примерка · 5 ⭐"}</span>
      </div>
    </div>
  );
}

function VideoTabContent({
  videoDesc, setVideoDesc, videoDuration, setVideoDuration,
  videoLooping, setVideoLooping, videoCardMode, setVideoCardMode,
  videoStars, hasFiles,
}: {
  videoDesc: string; setVideoDesc: (v: string) => void;
  videoDuration: VideoDuration; setVideoDuration: (v: VideoDuration) => void;
  videoLooping: boolean; setVideoLooping: (v: boolean) => void;
  videoCardMode: boolean; setVideoCardMode: (v: boolean) => void;
  videoStars: number; hasFiles: boolean;
}) {
  return (
    <TooltipProvider>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="bg-muted rounded px-2 py-0.5 font-medium text-foreground">Video</span>
          <span>· {videoStars} ⭐</span>
        </div>
        <span className={`text-xs ${hasFiles ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
          {hasFiles ? "✓ Фото загружено" : "Загрузите фото ↑"}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-foreground">Описание видео</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-48 text-xs">
                Опишите движение: камера приближается, товар вращается, плавный зум... Чем точнее — тем лучше результат
              </TooltipContent>
            </Tooltip>
          </div>
          <button className="flex items-center gap-1 text-xs text-primary font-medium opacity-70 hover:opacity-100 transition-opacity">
            <Sparkles className="w-3 h-3" />
            AI идея
          </button>
        </div>
        <Textarea
          value={videoDesc}
          onChange={(e) => setVideoDesc(e.target.value.slice(0, 1500))}
          placeholder="Например: плавное приближение к товару, медленное вращение на 360°, кинематографическая съёмка..."
          rows={4}
          className="resize-none text-sm"
          data-testid="input-video-desc"
        />
        <p className="text-right text-xs text-muted-foreground mt-1">{videoDesc.length}/1500</p>
      </div>

      <div className="space-y-4 pt-1 border-t border-border">
          <div>
            <div className="flex items-center gap-1 mb-2">
              <p className="text-xs font-medium text-foreground">Длительность</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-48 text-xs">
                  5 сек = {VIDEO_STAR_COSTS[5]} ⭐. 10 сек = {VIDEO_STAR_COSTS[10]} ⭐. Для соцсетей достаточно 5 секунд
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2">
              {([5, 10] as VideoDuration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setVideoDuration(d)}
                  data-testid={`duration-${d}`}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all flex flex-col items-center ${
                    videoDuration === d
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <span>{d} сек</span>
                  <span className="text-xs opacity-60">{VIDEO_STAR_COSTS[d as VideoDuration]} ⭐</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 flex-1 text-left"
              onClick={() => setVideoLooping(!videoLooping)}
              data-testid="toggle-looping"
            >
              {videoLooping ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <span className="text-xs text-foreground">Цикличное видео</span>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-48 text-xs">
                Видео бесшовно зациклится — для баннеров и витрин маркетплейсов
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 flex-1 text-left"
              onClick={() => setVideoCardMode(!videoCardMode)}
              data-testid="toggle-card-mode"
            >
              {videoCardMode ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              <span className="text-xs text-foreground">Режим карточки</span>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-48 text-xs">
                ИИ добавит текстовые блоки и элементы дизайна как на карточке товара
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ModelPills({ selected, onChange, stars }: { selected: ModelId; onChange: (m: ModelId) => void; stars: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-foreground mb-1.5">Модель</p>
      <div className="flex gap-1.5">
        {MODELS.map((m) => {
          const isSelected = selected === m.id;
          const canAfford = stars >= m.stars;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              data-testid={`model-${m.id}`}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-muted/30 hover:border-primary/40"
              } ${!canAfford ? "opacity-60" : ""}`}
            >
              <span className="font-semibold text-foreground leading-tight text-center mb-0.5">{m.name}</span>
              <span className="text-amber-500 font-medium">{m.stars} ⭐</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SmallUploadZone({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <div
      className={`rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center py-3 px-2 gap-1 ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/40 cursor-pointer"
      }`}
    >
      <ImagePlus className="w-4 h-4 text-muted-foreground/60" />
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function ResultsPanel({
  isDone, isProcessing, isError, activeGeneration, onNewGeneration, onAnimateVideo, animatingVideo, onRegenerationComplete, stars, onStarsChange,
}: {
  isDone: boolean; isProcessing: boolean; isError: boolean;
  activeGeneration: Generation | null;
  onNewGeneration: () => void;
  onAnimateVideo?: (imageUrl: string) => void;
  animatingVideo?: boolean;
  onRegenerationComplete?: (id: string) => void;
  stars: number;
  onStarsChange?: (n: number) => void;
}) {
  if (isDone && activeGeneration) {
    return (
      <ResultView
        generation={activeGeneration}
        onNewGeneration={onNewGeneration}
        onAnimateVideo={onAnimateVideo}
        animatingVideo={animatingVideo}
        onRegenerationComplete={onRegenerationComplete}
        stars={stars}
        onStarsChange={onStarsChange}
      />
    );
  }
  if (isProcessing && activeGeneration) {
    return <ProcessingView generation={activeGeneration} />;
  }
  if (isError && activeGeneration) {
    return <ErrorView generation={activeGeneration} onRetry={onNewGeneration} />;
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Результаты</span>
      </div>
      <div className="flex items-center justify-center py-12 sm:py-16 text-center px-4 sm:px-6">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Target className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">Здесь появится результат после генерации</p>
        </div>
      </div>
    </Card>
  );
}

function StarBalance({ stars }: { stars: number }) {
  const isEmpty = stars === 0;
  const isLow = stars > 0 && stars <= 3;
  const gens = starsToGenerations(stars);
  const colorClass = isEmpty
    ? "bg-destructive/10 border-destructive/30 text-destructive"
    : isLow
    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
    : "bg-primary/10 border-primary/20 text-primary";

  return (
    <div className="relative group">
      <div
        data-testid="star-balance"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border cursor-default ${colorClass}`}
      >
        <Star className={`w-3.5 h-3.5 ${isEmpty || isLow ? "" : "fill-current"}`} />
        <span>{stars} ⭐</span>
      </div>
      <div className="absolute right-0 top-full mt-2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 max-w-[calc(100vw-1rem)]">
        <div className="bg-popover border border-border rounded-xl shadow-lg px-4 py-3 w-52 space-y-2.5">
          <p className="text-xs font-semibold text-foreground">Баланс звёзд</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Осталось звёзд</span>
              <span className="font-bold text-amber-500">{stars} ⭐</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" /> Pro (7⭐/кард)
              </span>
              <span className="font-semibold text-primary">{gens.pro} кард</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Nano2 (3⭐/кард)
              </span>
              <span className="font-semibold text-foreground">{gens.nano2} кард</span>
            </div>
          </div>
          {isLow && <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium pt-0.5">⚠️ Звёзды заканчиваются — пополните на странице тарифов</p>}
          {isEmpty && <p className="text-xs text-destructive font-medium pt-0.5">Нет звёзд — перейдите к тарифам</p>}
        </div>
      </div>
    </div>
  );
}

function ProcessingView({ generation }: { generation: Generation }) {
  const genType = (generation as any).generationType as string | undefined;
  const isVideo = genType === "video";
  const isTryon = genType === "tryon";

  const cardSteps = [
    { key: "analyzing", label: "Анализ товара (GPT-4o)", desc: "Изучаем фото и создаём продающий текст" },
    { key: "uploading", label: "Подготовка изображения", desc: "Загружаем фото для обработки" },
    { key: "generating", label: "Генерация карточки (Nano Banana)", desc: "ИИ создаёт профессиональный дизайн" },
  ];
  const videoSteps = [
    { key: "uploading", label: "Загрузка фото", desc: "Подготавливаем изображение" },
    { key: "generating", label: "Создание видео", desc: "ИИ анимирует изображение. Это занимает 2–5 минут" },
    { key: "done", label: "Финальная обработка", desc: "Проверяем и сохраняем видео" },
  ];
  const tryonSteps = [
    { key: "uploading", label: "Загрузка фото", desc: "Загружаем фото модели и одежды" },
    { key: "generating", label: "Примерка (Nano Banana 2)", desc: "ИИ виртуально примеряет одежду. Занимает 1–3 минуты" },
    { key: "done", label: "Готово!", desc: "Примерка сохранена" },
  ];

  const steps = isVideo ? videoSteps : isTryon ? tryonSteps : cardSteps;
  const currentIdx = steps.findIndex((s) => s.key === generation.status);
  const modelInfo = MODELS.find((m) => m.id === generation.model);

  const title = isVideo ? "Создаём видео..." : isTryon ? "Примеряем одежду..." : "Создаём карточку товара...";
  const timeEst = isVideo ? "Обычно занимает 2–5 минут" : isTryon ? "Обычно занимает 1–2 минуты" : "Обычно занимает 1–3 минуты";
  const icon = isVideo ? <Video className="w-6 h-6 text-primary animate-pulse" /> : isTryon ? <Camera className="w-6 h-6 text-primary animate-pulse" /> : <Sparkles className="w-6 h-6 text-primary animate-pulse" />;

  return (
    <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 relative">
          {icon}
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{timeEst}</p>
        {!isVideo && !isTryon && modelInfo && (
          <div className="inline-flex items-center gap-1.5 mt-2 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            {modelInfo.name} · {generation.aspectRatio}
          </div>
        )}
        {isTryon && (
          <div className="inline-flex items-center gap-1.5 mt-2 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            Nano Banana 2
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {steps.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-primary/20 border-2 border-primary" :
                "bg-muted border-2 border-border"
              }`}>
                {done ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : active ? (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${active || done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                {active && <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {!isVideo && !isTryon && (generation.gptAnalysis as any)?.title && (
        <>
          <Separator />
          <div className="space-y-1.5 p-3 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">GPT придумал название:</p>
            <p className="text-sm font-semibold text-foreground">"{(generation.gptAnalysis as any).title}"</p>
          </div>
        </>
      )}
    </Card>
  );
}

function ErrorView({ generation, onRetry }: { generation: Generation; onRetry: () => void }) {
  return (
    <Card className="p-4 sm:p-6 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div>
        <h3 className="font-semibold text-foreground mb-1">Ошибка генерации</h3>
        <p className="text-sm text-muted-foreground">{generation.errorMessage || "Что-то пошло не так"}</p>
      </div>
      <Button onClick={onRetry} data-testid="button-retry">Попробовать снова</Button>
    </Card>
  );
}

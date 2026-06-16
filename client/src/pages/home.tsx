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
  CreditCard, Loader2, Camera, Type, Video,
  ImagePlus, X, Info, Target,
  CheckSquare, Square, Check, User, LogIn,
  ShoppingCart,
} from "lucide-react";
import type { Generation } from "@shared/schema";
import {
  MODELS, ASPECT_RATIOS, VIDEO_STAR_COSTS, TRYON_STAR_COST, TRIAL_LIMIT,
  type ModelId, type AspectRatioId,
} from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type GarmentCategory = "head" | "top" | "bottom" | "feet" | "extra";
const GARMENT_CATEGORIES: { id: GarmentCategory; label: string; examples: string }[] = [
  { id: "head", label: "Голова / аксессуары", examples: "Шапка, кепка, очки, шарф, берет" },
  { id: "top", label: "Верх", examples: "Футболка, пиджак, рубашка, платье, свитер" },
  { id: "bottom", label: "Низ", examples: "Штаны, юбка, колготки, джинсы, шорты" },
  { id: "feet", label: "Ноги", examples: "Ботинки, кроссовки, кеды, сапоги, сандалии" },
  { id: "extra", label: "Дополнительно", examples: "Сумка, ремень, часы, бижутерия, пальто" },
];

const NANO2_BALANCE_KEY = "kardo_nano2_balance";
const PRO_BALANCE_KEY = "kardo_pro_balance";
const TRIAL_COUNT_KEY = "kardo_trial_count";
const USER_KEY = "kardo_user";

function getTrialCount(): number {
  return parseInt(localStorage.getItem(TRIAL_COUNT_KEY) || "0", 10);
}
function setTrialCount(n: number) {
  localStorage.setItem(TRIAL_COUNT_KEY, String(Math.max(0, n)));
}
function getBalance(key: string): number {
  return parseInt(localStorage.getItem(key) || "0", 10);
}
function setBalance(key: string, n: number) {
  localStorage.setItem(key, String(Math.max(0, n)));
}
function getUsername(): string | null {
  return localStorage.getItem(USER_KEY);
}
function setUsername(name: string | null) {
  if (name) localStorage.setItem(USER_KEY, name);
  else localStorage.removeItem(USER_KEY);
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
  const [noText, setNoText] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("nano-banana-pro");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioId>("1:1");
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);

  const [username, setUsernameState] = useState<string | null>(getUsername);
  const [nano2Balance, setNano2Balance] = useState<number>(() => getBalance(NANO2_BALANCE_KEY));
  const [proBalance, setProBalance] = useState<number>(() => getBalance(PRO_BALANCE_KEY));
  const [trialCount, setTrialCountState] = useState<number>(getTrialCount);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [isTrialGeneration, setIsTrialGeneration] = useState(false);

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

  const isAuth = !!username;
  const currentBalance = selectedModel === "nano-banana-2" ? nano2Balance : proBalance;
  const tryonBalance = nano2Balance;

  const updateBalance = (model: ModelId, n: number) => {
    const key = model === "nano-banana-2" ? NANO2_BALANCE_KEY : PRO_BALANCE_KEY;
    setBalance(key, n);
    if (model === "nano-banana-2") setNano2Balance(Math.max(0, n));
    else setProBalance(Math.max(0, n));
  };

  useEffect(() => {
    const onStorage = () => {
      setNano2Balance(getBalance(NANO2_BALANCE_KEY));
      setProBalance(getBalance(PRO_BALANCE_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleAuthSubmit = () => {
    const name = authUsername.trim();
    if (!name) return;
    setUsername(name);
    setUsernameState(name);
    setAuthModalOpen(false);
    setAuthUsername("");
    toast({ title: `Добро пожаловать, ${name}!`, description: "Теперь купите пакет карточек для генерации без водяных знаков." });
  };

  const handleLogout = () => {
    setUsername(null);
    setUsernameState(null);
    toast({ title: "Вы вышли из аккаунта" });
  };

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
    if (polledGeneration.status === "done") {
      if (isAuth) {
        const genType = (polledGeneration as any).generationType || "card";
        if (genType === "tryon") {
          updateBalance("nano-banana-2", getBalance(NANO2_BALANCE_KEY) - 1);
        } else {
          const model = (polledGeneration.model as ModelId) || selectedModel;
          updateBalance(model, getBalance(model === "nano-banana-2" ? NANO2_BALANCE_KEY : PRO_BALANCE_KEY) - 1);
        }
      } else {
        const newCount = getTrialCount() + 1;
        setTrialCount(newCount);
        setTrialCountState(newCount);
      }
    }
    if (polledGeneration.status === "error") {
      toast({
        title: "Ошибка генерации",
        description: polledGeneration.errorMessage || "Не удалось создать карточку.",
        variant: "destructive",
      });
    }
  }, [polledGeneration?.status]);

  const currentModel = MODELS.find((m) => m.id === selectedModel)!;
  const videoStars = VIDEO_STAR_COSTS[videoDuration];

  const hasAnyGarment = Object.values(tryonGarments).some((g) => g.file !== null);

  const trialRemaining = TRIAL_LIMIT - trialCount;

  const canGenerate =
    activeTab === "card"
      ? (isAuth ? currentBalance > 0 : trialCount < TRIAL_LIMIT) && selectedFiles.length > 0
      : activeTab === "photo"
      ? (isAuth ? nano2Balance > 0 : true) && selectedFiles.length > 0 && hasAnyGarment
      : false;

  const cardMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model", selectedModel);
      formData.append("aspectRatio", selectedAspectRatio);
      if (notes.trim()) formData.append("notes", notes.trim());
      if (noText) formData.append("noText", "true");
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
      setIsTrialGeneration(!isAuth);
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
      const garmentFiles = Object.values(tryonGarments).map((g) => g.file).filter(Boolean) as File[];
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
    setIsTrialGeneration(false);
  };

  const [animatingVideo, setAnimatingVideo] = useState(false);

  const handleAnimateVideo = async (imageUrl: string) => {
    if (animatingVideo) return;
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
      const file = new File([blob], "result.png", { type: blob.type || "image/png" });
      const formData = new FormData();
      formData.append("image", file);
      formData.append("duration", "5");
      formData.append("prompt", "Smooth product showcase, slow graceful movement, cinematic quality");
      const response = await fetch("/api/generate-video", { method: "POST", body: formData });
      if (!response.ok) {
        const text = await response.text();
        let msg = "Ошибка запуска видео";
        try { msg = JSON.parse(text)?.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await response.json();
      setActiveGenerationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
      toast({ title: "Видео запущено!", description: "Оживление карточки началось" });
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

  const isDone = activeGeneration?.status === "done";
  const isProcessing = activeGeneration && !["done", "error"].includes(activeGeneration.status ?? "");
  const isError = activeGeneration?.status === "error";

  return (
    <div className="min-h-screen bg-background">
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Войти / Зарегистрироваться</h2>
              <button onClick={() => setAuthModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Введите имя пользователя. После регистрации вы сможете купить пакеты карточек и генерировать без водяных знаков.
            </p>
            <input
              type="text"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAuthSubmit(); }}
              placeholder="Ваше имя или email"
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              data-testid="input-auth-username"
            />
            <Button className="w-full" onClick={handleAuthSubmit} disabled={!authUsername.trim()} data-testid="button-auth-submit">
              Продолжить
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Пробный режим: 3 карточки с водяным знаком бесплатно
            </p>
          </Card>
        </div>
      )}

      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
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
          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <button
                className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
                data-testid="link-pricing"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Тарифы
              </button>
            </Link>
            {isAuth && (
              <Link href="/profile">
                <button
                  className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
                  data-testid="link-profile"
                >
                  <User className="w-3.5 h-3.5" />
                  Профиль
                </button>
              </Link>
            )}
            {isAuth ? (
              <div className="flex items-center gap-2">
                <CardBalance nano2={nano2Balance} pro={proBalance} username={username!} onLogout={handleLogout} />
              </div>
            ) : (
              <>
                <TrialBadge count={trialCount} limit={TRIAL_LIMIT} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs"
                  data-testid="button-login"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Войти</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

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
              noText={noText}
              setNoText={setNoText}
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
              isAuth={isAuth}
              currentBalance={currentBalance}
              tryonBalance={tryonBalance}
              trialCount={trialCount}
              trialLimit={TRIAL_LIMIT}
              canGenerate={canGenerate}
              currentModel={currentModel}
              videoStars={videoStars}
              isPending={cardMutation.isPending || videoMutation.isPending || tryonMutation.isPending}
              hasFiles={selectedFiles.length > 0}
              selectedFiles={selectedFiles}
              onGenerate={handleGenerate}
              onAuthOpen={() => setAuthModalOpen(true)}
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
              isTrial={isTrialGeneration || !isAuth}
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
                  <p className="font-medium text-foreground">Купить пакет карточек</p>
                  <p className="text-xs text-muted-foreground">от 199 ₽ за 3 карточки</p>
                </div>
                <ShoppingCart className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
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
  noText, setNoText,
  selectedModel, setSelectedModel,
  selectedFormat, handleFormatSelect,
  creativity, setCreativity,
  advancedOpen, setAdvancedOpen,
  videoDuration, setVideoDuration,
  videoLooping, setVideoLooping,
  videoCardMode, setVideoCardMode,
  videoDesc, setVideoDesc,
  tryonGarments, setTryonGarments,
  isAuth, currentBalance, tryonBalance, trialCount, trialLimit,
  canGenerate, currentModel, videoStars, isPending, hasFiles,
  selectedFiles,
  onGenerate, onAuthOpen,
}: {
  activeTab: ContentTab; setActiveTab: (t: ContentTab) => void;
  notes: string; setNotes: (v: string) => void;
  noText: boolean; setNoText: (v: boolean) => void;
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
  isAuth: boolean; currentBalance: number; tryonBalance: number; trialCount: number; trialLimit: number;
  canGenerate: boolean;
  currentModel: typeof MODELS[number];
  videoStars: number;
  isPending: boolean; hasFiles: boolean;
  selectedFiles: File[];
  onGenerate: () => void;
  onAuthOpen: () => void;
}) {
  const hasAnyGarment = Object.values(tryonGarments).some((g) => g.file !== null);
  const trialRemaining = trialLimit - trialCount;
  const trialExhausted = !isAuth && trialCount >= trialLimit;

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
          noText={noText}
          setNoText={setNoText}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isAuth={isAuth}
          currentBalance={currentBalance}
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

      <div className="mt-4 space-y-2">
        {!isAuth && !trialExhausted && (
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">Пробный режим</span>
            <span className={`font-medium ${trialRemaining <= 1 ? "text-destructive" : "text-muted-foreground"}`}>
              {trialRemaining} из {trialLimit} карточек осталось
            </span>
          </div>
        )}

        {trialExhausted && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-center space-y-2">
            <p className="text-xs font-medium text-foreground">Пробный лимит исчерпан</p>
            <p className="text-xs text-muted-foreground">Войдите и купите пакет для генерации без ограничений</p>
            <Button size="sm" className="w-full text-xs" onClick={onAuthOpen} data-testid="button-auth-prompt">
              <LogIn className="w-3.5 h-3.5 mr-1.5" />
              Войти / Зарегистрироваться
            </Button>
          </div>
        )}

        {isAuth && activeTab === "card" && hasFiles && currentBalance === 0 && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-center space-y-2">
            <p className="text-xs font-medium text-foreground">Недостаточно карточек</p>
            <p className="text-xs text-muted-foreground">Купите пакет чтобы продолжить генерацию</p>
            <Link href="/pricing">
              <Button size="sm" className="w-full text-xs" data-testid="button-buy-pack">
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                Купить пакет
              </Button>
            </Link>
          </div>
        )}

        {isAuth && activeTab === "photo" && hasFiles && tryonBalance === 0 && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-center space-y-2">
            <p className="text-xs font-medium text-foreground">Недостаточно примерок</p>
            <p className="text-xs text-muted-foreground">Купите пакет Nano Banana 2 чтобы продолжить примерку</p>
            <Link href="/pricing">
              <Button size="sm" className="w-full text-xs" data-testid="button-buy-pack">
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                Купить пакет
              </Button>
            </Link>
          </div>
        )}

        {/* Show button for non-trial-exhausted OR if photo tab (tryon is always free) */}
        {(!trialExhausted && !(isAuth && activeTab === "card" && hasFiles && currentBalance === 0)) &&
         !(isAuth && activeTab === "photo" && hasFiles && tryonBalance === 0) && (
          <>
            {activeTab === "card" && !hasFiles && (
              <p className="text-xs text-muted-foreground text-center">Сначала загрузите фото товара</p>
            )}
            {activeTab === "photo" && !hasFiles && (
              <p className="text-xs text-muted-foreground text-center">Загрузите фото модели в блоке выше</p>
            )}
            {activeTab === "photo" && hasFiles && !hasAnyGarment && (
              <p className="text-xs text-muted-foreground text-center">Загрузите фото одежды ниже</p>
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
              ) : activeTab === "photo" ? (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  {hasFiles && hasAnyGarment
                    ? (isAuth ? `Примерить · 1 карточка` : "Примерить (бесплатно)")
                    : "Загрузите фото и одежду"}
                </>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />{hasFiles ? `Создать карточку · ${currentModel.pricePerCard} ₽` : "Загрузите фото"}</>
              )}
            </Button>
            {!isAuth && hasFiles && activeTab === "card" && (
              <p className="text-xs text-muted-foreground text-center">
                Карточка будет с водяным знаком.{" "}
                <button className="text-primary hover:underline" onClick={onAuthOpen}>Войдите</button>
                {" "}и купите пакет для чистого результата.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function CardTabContent({
  notes, setNotes, noText, setNoText, selectedModel, setSelectedModel, isAuth, currentBalance,
  selectedFiles,
}: {
  notes: string; setNotes: (v: string) => void;
  noText: boolean; setNoText: (v: boolean) => void;
  selectedModel: ModelId; setSelectedModel: (m: ModelId) => void;
  isAuth: boolean; currentBalance: number;
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
        <p className="text-xs text-muted-foreground mb-1.5">Напишите в свободной форме, какой текст хотите видеть на карточке</p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Например: натуральный состав, приятный запах, быстрый эффект..."
          rows={3}
          className="resize-none text-sm"
          data-testid="input-notes"
        />
      </div>

      <ModelPills selected={selectedModel} onChange={setSelectedModel} isAuth={isAuth} currentBalance={currentBalance} />

      <div>
        <button
          className="flex items-center gap-2 w-full text-left"
          onClick={() => setNoText(!noText)}
          data-testid="toggle-no-text"
        >
          {noText
            ? <CheckSquare className="w-4 h-4 text-primary flex-shrink-0" />
            : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          <span className="text-xs text-foreground font-medium">Только фон (без текста)</span>
        </button>
        {noText && (
          <p className="text-xs text-muted-foreground mt-1 pl-6">
            ИИ создаст только товар + фон, без текстовых надписей. Вы сможете добавить текст вручную.
          </p>
        )}
      </div>
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
        <span>{hasAnyGarment ? `${Object.values(tryonGarments).filter(g => g.file).length} / 5 элементов` : "— ИИ-примерка"}</span>
      </div>
    </div>
  );
}

function ModelPills({ selected, onChange, isAuth, currentBalance }: {
  selected: ModelId;
  onChange: (m: ModelId) => void;
  isAuth: boolean;
  currentBalance: number;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-foreground mb-1.5">Модель</p>
      <div className="flex gap-1.5">
        {MODELS.map((m) => {
          const isSelected = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              data-testid={`model-${m.id}`}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-muted/30 hover:border-primary/40"
              }`}
            >
              <span className="font-semibold text-foreground leading-tight text-center mb-0.5">{m.name}</span>
              <span className="text-primary font-medium">{m.pricePerCard} ₽/кард</span>
              {isAuth && isSelected && (
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {currentBalance > 0 ? `${currentBalance} осталось` : "0 карточек"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrialBadge({ count, limit }: { count: number; limit: number }) {
  const remaining = limit - count;
  const isEmpty = remaining === 0;
  const isLow = remaining === 1;
  const colorClass = isEmpty
    ? "bg-destructive/10 border-destructive/30 text-destructive"
    : isLow
    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600"
    : "bg-muted border-border text-muted-foreground";

  return (
    <div
      data-testid="trial-badge"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      <Sparkles className="w-3 h-3" />
      <span>{isEmpty ? "Лимит исчерпан" : `${remaining}/${limit} пробных`}</span>
    </div>
  );
}

function CardBalance({ nano2, pro, username, onLogout }: { nano2: number; pro: number; username: string; onLogout: () => void }) {
  return (
    <div className="relative group">
      <div
        data-testid="card-balance"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border bg-primary/10 border-primary/20 text-primary cursor-default"
      >
        <User className="w-3.5 h-3.5" />
        <span className="hidden sm:inline max-w-[80px] truncate">{username}</span>
        <span>·</span>
        <span>{nano2 + pro} карт.</span>
      </div>
      <div className="absolute right-0 top-full mt-2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150">
        <div className="bg-popover border border-border rounded-xl shadow-lg px-4 py-3 w-56 space-y-2.5">
          <p className="text-xs font-semibold text-foreground">Баланс карточек</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Nano Banana 2
              </span>
              <span className="font-bold text-foreground">{nano2} кард.</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Star className="w-3 h-3 text-primary" /> Nano Banana Pro
              </span>
              <span className="font-bold text-primary">{pro} кард.</span>
            </div>
          </div>
          <Link href="/profile">
            <Button size="sm" variant="secondary" className="w-full text-xs pointer-events-auto">
              <User className="w-3 h-3 mr-1.5" />
              Личный кабинет
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="sm" variant="outline" className="w-full text-xs pointer-events-auto">
              <ShoppingCart className="w-3 h-3 mr-1.5" />
              Купить пакет
            </Button>
          </Link>
          <button
            onClick={onLogout}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center pt-0.5"
            data-testid="button-logout"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({
  isDone, isProcessing, isError, activeGeneration, onNewGeneration, onAnimateVideo, animatingVideo, onRegenerationComplete, isTrial,
}: {
  isDone: boolean; isProcessing: boolean; isError: boolean;
  activeGeneration: Generation | null;
  onNewGeneration: () => void;
  onAnimateVideo?: (imageUrl: string) => void;
  animatingVideo?: boolean;
  onRegenerationComplete?: (id: string) => void;
  isTrial: boolean;
}) {
  if (isDone && activeGeneration) {
    return (
      <ResultView
        generation={activeGeneration}
        onNewGeneration={onNewGeneration}
        onAnimateVideo={onAnimateVideo}
        animatingVideo={animatingVideo}
        onRegenerationComplete={onRegenerationComplete}
        isTrial={isTrial}
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
  const icon = isVideo
    ? <Video className="w-6 h-6 text-primary animate-pulse" />
    : isTryon
    ? <Camera className="w-6 h-6 text-primary animate-pulse" />
    : <Sparkles className="w-6 h-6 text-primary animate-pulse" />;

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

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer, Group } from "react-konva";
import type { Generation, GptAnalysis, MarketplaceFormatId } from "@shared/schema";
import { MARKETPLACE_FORMATS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Download,
  Type,
  LayoutTemplate,
  Trash2,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Layers,
  CheckCircle2,
  Plus,
  AlignLeft,
  Move,
  Eye,
  Droplet,
  Sun,
  Aperture,
  Crop,
  ImagePlus,
  Upload,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Konva from "konva";
import { downloadEditorPng, getEditorSceneAppearance } from "@shared/editor-export";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

const CANVAS_W = 800;
const CANVAS_H = 800;

type ElementKind = "text" | "badge" | "cta";
type BackgroundMode = "generated" | "color" | "image";

const EDITOR_COLORS = [
  "#ffffff", "#f8fafc", "#e2e8f0", "#94a3b8", "#475569", "#0f172a",
  "#000000", "#fef2f2", "#ef4444", "#f97316", "#f59e0b", "#facc15",
  "#ecfccb", "#84cc16", "#22c55e", "#10b981", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#be123c",
];

function normalizeColor(value: string): string | null {
  const trimmed = value.trim();
  const hex = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].toLowerCase();
    return `#${raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw}`;
  }

  const rgb = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i
  );
  if (rgb && rgb.slice(1, 4).every((channel) => Number(channel) <= 255)) {
    return `#${rgb.slice(1, 4).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  return null;
}

interface CanvasElement {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  fill?: string;
  bgColor?: string;
  bold?: boolean;
  width?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  bgOpacity?: number;
}

interface SavedElementStyle {
  fill?: string;
  bgColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  bgOpacity?: number;
}

interface SavedCardAppearance {
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  customBackgroundUrl: string | null;
  elements?: CanvasElement[];
  elementStyles?: SavedElementStyle[];
}

interface PendingAppearanceJournal {
  appearance: SavedCardAppearance;
  customBackgroundUrlOmitted: boolean;
}

const APPEARANCE_DB_NAME = "kardomatik-editor";
const APPEARANCE_STORE_NAME = "card-appearances";
const APPEARANCE_PENDING_KEY_PREFIX = "kardomatik-editor-pending:";
const MAX_JOURNALED_BACKGROUND_LENGTH = 512 * 1024;
const appearanceWriteQueues = new Map<string, Promise<void>>();
let appearanceDb: IDBDatabase | null = null;

function pendingAppearanceKey(cardId: string): string {
  return `${APPEARANCE_PENDING_KEY_PREFIX}${cardId}`;
}

function readPendingAppearance(cardId: string): PendingAppearanceJournal | null {
  try {
    const saved = window.localStorage.getItem(pendingAppearanceKey(cardId));
    return saved ? JSON.parse(saved) as PendingAppearanceJournal : null;
  } catch {
    return null;
  }
}

function writePendingAppearance(cardId: string, appearance: SavedCardAppearance): string | null {
  try {
    const customBackgroundUrlOmitted =
      (appearance.customBackgroundUrl?.length ?? 0) > MAX_JOURNALED_BACKGROUND_LENGTH;
    const journal: PendingAppearanceJournal = {
      appearance: customBackgroundUrlOmitted
        ? { ...appearance, customBackgroundUrl: null }
        : appearance,
      customBackgroundUrlOmitted,
    };
    const serialized = JSON.stringify(journal);
    window.localStorage.setItem(pendingAppearanceKey(cardId), serialized);
    return serialized;
  } catch {
    return null;
  }
}

function openAppearanceDb(): Promise<IDBDatabase> {
  if (appearanceDb) return Promise.resolve(appearanceDb);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(APPEARANCE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(APPEARANCE_STORE_NAME)) {
        request.result.createObjectStore(APPEARANCE_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      appearanceDb = request.result;
      appearanceDb.onversionchange = () => {
        appearanceDb?.close();
        appearanceDb = null;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDbAppearance(cardId: string): Promise<SavedCardAppearance | null> {
  const db = await openAppearanceDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(APPEARANCE_STORE_NAME, "readonly");
    const request = transaction.objectStore(APPEARANCE_STORE_NAME).get(cardId);
    request.onsuccess = () => resolve((request.result as SavedCardAppearance | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedAppearance(cardId: string): Promise<SavedCardAppearance | null> {
  const pending = readPendingAppearance(cardId);
  await appearanceWriteQueues.get(cardId)?.catch(() => undefined);
  if (!pending) return readIndexedDbAppearance(cardId);
  if (!pending.customBackgroundUrlOmitted) return pending.appearance;
  const persisted = await readIndexedDbAppearance(cardId);
  return {
    ...pending.appearance,
    customBackgroundUrl: persisted?.customBackgroundUrl ?? null,
  };
}

async function writeSavedAppearance(cardId: string, appearance: SavedCardAppearance): Promise<void> {
  const db = appearanceDb ?? await openAppearanceDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(APPEARANCE_STORE_NAME, "readwrite");
    transaction.objectStore(APPEARANCE_STORE_NAME).put(appearance, cardId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function enqueueAppearanceWrite(cardId: string, appearance: SavedCardAppearance): Promise<void> {
  const serializedAppearance = writePendingAppearance(cardId, appearance);
  const previous = appearanceWriteQueues.get(cardId);
  const next = previous
    ? previous.catch(() => undefined).then(() => writeSavedAppearance(cardId, appearance))
    : writeSavedAppearance(cardId, appearance);
  appearanceWriteQueues.set(cardId, next);
  const clearCompletedWrite = () => {
    if (appearanceWriteQueues.get(cardId) === next) {
      appearanceWriteQueues.delete(cardId);
    }
  };
  void next.then(() => {
    if (serializedAppearance !== null) {
      try {
        if (window.localStorage.getItem(pendingAppearanceKey(cardId)) === serializedAppearance) {
          window.localStorage.removeItem(pendingAppearanceKey(cardId));
        }
      } catch {
        // IndexedDB already contains the appearance; journal cleanup can be retried later.
      }
    }
    clearCompletedWrite();
  }, clearCompletedWrite);
  return next;
}

function defaultStyleForElement(element: CanvasElement): SavedElementStyle {
  return {
    fill: "#ffffff",
    bgColor: element.kind === "badge" ? "#7c3aed" : element.kind === "cta" ? "#059669" : undefined,
    shadowColor: undefined,
    shadowBlur: undefined,
    shadowOpacity: undefined,
    shadowOffsetX: undefined,
    shadowOffsetY: undefined,
    bgOpacity: undefined,
  };
}

function applyElementStyles(elements: CanvasElement[], styles: SavedElementStyle[]): CanvasElement[] {
  return elements.map((element, index) => ({ ...element, ...(styles[index] ?? {}) }));
}

function proxyUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function useKonvaImage(src: string | null | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImg(null); return; }
    const el = new window.Image();
    el.onload = () => setImg(el);
    el.onerror = () => setImg(null);
    el.src = src;
  }, [src]);
  return img;
}

function useRemovedBgImage(src: string | null | undefined) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!src) return;
    setLoading(true);

    import("@imgly/background-removal").then(({ removeBackground }) => {
      fetch(src)
        .then(r => r.blob())
        .then(blob => removeBackground(blob, { progress: () => {} }))
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setResult(url);
          setLoading(false);
        })
        .catch(() => {
          setResult(src);
          setLoading(false);
        });
    }).catch(() => {
      setResult(src);
      setLoading(false);
    });
  }, [src]);

  return { result, loading };
}

function nanoid6() {
  return Math.random().toString(36).slice(2, 8);
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: generation, isLoading } = useQuery<Generation>({
    queryKey: ["/api/generation", id],
    queryFn: () => fetch(`/api/generation/${id}`).then(r => r.json()),
    enabled: !!id,
    refetchInterval: (query) => {
      const g = query.state.data as Generation | undefined;
      if (g && g.status === "done" && g.backgroundTaskId && !g.backgroundImageUrl) return 3000;
      return false;
    },
  });

  const [isAuth, setIsAuth] = useState(false);
  const [hasBalance, setHasBalance] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then((user: any) => {
        setIsAuth(!!user);
        setHasBalance(!!user && (user.nano2Balance > 0 || user.proBalance > 0));
      })
      .catch(() => {});
  }, []);

  const analysis = generation?.gptAnalysis as GptAnalysis | null;
  const { toast } = useToast();

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("generated");
  const [backgroundColor, setBackgroundColor] = useState("#1a1a2e");
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(null);
  const [savedElements, setSavedElements] = useState<CanvasElement[] | null>(null);
  const [legacySavedElementStyles, setLegacySavedElementStyles] = useState<SavedElementStyle[] | null>(null);
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  const [editorInitialized, setEditorInitialized] = useState(false);
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedRef = useRef<Konva.Node | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const [exportFormatId, setExportFormatId] = useState<MarketplaceFormatId>("square-standard");
  const [isElementsPanelOpen, setIsElementsPanelOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches
  );
  const [visualViewportHeight, setVisualViewportHeight] = useState(() =>
    typeof window === "undefined" ? 0 : (window.visualViewport?.height ?? window.innerHeight)
  );
  const appearanceSaveErrorShown = useRef(false);
  const pendingAppearanceRef = useRef<{ cardId: string; appearance: SavedCardAppearance } | null>(null);
  const appearanceSaveTimeoutRef = useRef<number | null>(null);
  const currentAppearanceRef = useRef<SavedCardAppearance>({
    backgroundMode,
    backgroundColor,
    customBackgroundUrl,
    elements,
  });
  currentAppearanceRef.current = {
    backgroundMode,
    backgroundColor,
    customBackgroundUrl,
    elements,
  };
  const editingPanelRef = useRef<HTMLDivElement>(null);

  const stageAppearance = (appearance: SavedCardAppearance) => {
    currentAppearanceRef.current = appearance;
    if (!id || !editorInitialized || typeof indexedDB === "undefined") return;
    pendingAppearanceRef.current = { cardId: id, appearance };
    writePendingAppearance(id, appearance);
  };

  const changeBackgroundMode = (mode: BackgroundMode) => {
    stageAppearance({ ...currentAppearanceRef.current, backgroundMode: mode });
    setBackgroundMode(mode);
  };

  const changeBackgroundColor = (color: string) => {
    stageAppearance({ ...currentAppearanceRef.current, backgroundColor: color });
    setBackgroundColor(color);
  };

  const changeCustomBackgroundUrl = (url: string | null) => {
    stageAppearance({ ...currentAppearanceRef.current, customBackgroundUrl: url });
    setCustomBackgroundUrl(url);
  };

  const changeElements = (update: (current: CanvasElement[]) => CanvasElement[]) => {
    const nextElements = update(currentAppearanceRef.current.elements ?? []);
    stageAppearance({ ...currentAppearanceRef.current, elements: nextElements });
    setElements(nextElements);
  };

  const flushPendingAppearance = () => {
    if (appearanceSaveTimeoutRef.current !== null) {
      window.clearTimeout(appearanceSaveTimeoutRef.current);
      appearanceSaveTimeoutRef.current = null;
    }
    const pending = pendingAppearanceRef.current;
    if (!pending) return;
    pendingAppearanceRef.current = null;
    enqueueAppearanceWrite(pending.cardId, pending.appearance).catch(() => {
      if (appearanceSaveErrorShown.current) return;
      appearanceSaveErrorShown.current = true;
      toast({
        title: "Не удалось сохранить оформление",
        description: "Проверьте доступное место в браузере и попробуйте ещё раз.",
        variant: "destructive",
      });
    });
  };

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewportHeight = () => {
      setVisualViewportHeight(viewport?.height ?? window.innerHeight);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    viewport?.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      viewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAppearanceLoaded(false);
    setEditorInitialized(false);
    setSavedElements(null);
    setLegacySavedElementStyles(null);

    if (!id || typeof indexedDB === "undefined") {
      setAppearanceLoaded(true);
      return;
    }

    readSavedAppearance(id)
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          setBackgroundMode(saved.backgroundMode);
          setBackgroundColor(saved.backgroundColor);
          setCustomBackgroundUrl(saved.customBackgroundUrl);
          setSavedElements(saved.elements ?? null);
          setLegacySavedElementStyles(saved.elements ? null : (saved.elementStyles ?? null));
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: "Не удалось восстановить оформление",
            description: "Карточка открыта со стандартным оформлением.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setAppearanceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  useEffect(() => {
    const updateCanvasScale = () => {
      const viewport = canvasViewportRef.current;
      const availableWidth = viewport?.clientWidth ?? 0;
      const availableHeight = viewport?.clientHeight ?? 0;
      if (availableWidth > 0 && availableHeight > 0) {
        const horizontalPadding = window.innerWidth < 640 ? 16 : 32;
        const verticalPadding = window.innerWidth < 640 ? 16 : 32;
        setCanvasScale(Math.min(
          1,
          Math.max(1, availableWidth - horizontalPadding) / CANVAS_W,
          Math.max(1, availableHeight - verticalPadding) / CANVAS_H,
        ));
      }
    };

    updateCanvasScale();
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateCanvasScale)
      : null;
    if (observer && canvasViewportRef.current) {
      observer.observe(canvasViewportRef.current);
    }
    window.addEventListener("resize", updateCanvasScale);
    window.visualViewport?.addEventListener("resize", updateCanvasScale);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateCanvasScale);
      window.visualViewport?.removeEventListener("resize", updateCanvasScale);
    };
  }, [generation?.id]);

  const generatedBgSrc = proxyUrl(generation?.backgroundImageUrl);
  const bgImg = useKonvaImage(
    backgroundMode === "image"
      ? customBackgroundUrl
      : backgroundMode === "generated"
        ? generatedBgSrc
        : null
  );
  const cardImg = useKonvaImage(proxyUrl(generation?.resultImageUrl));
  const { result: removedBgSrc, loading: removingBg } = useRemovedBgImage(
    generation?.originalImageUrl?.startsWith("data:") ? generation.originalImageUrl : null
  );
  const removedBgImg = useKonvaImage(removedBgSrc);

  const textLayerRef = useRef<Konva.Layer>(null);
  const [textLayerSnapshot, setTextLayerSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!appearanceLoaded || editorInitialized || generation === undefined) return;
    if (savedElements) {
      setElements(savedElements);
      setEditorInitialized(true);
      return;
    }
    if (!analysis) {
      setEditorInitialized(true);
      return;
    }
    const initial: CanvasElement[] = [];
    initial.push({
      id: nanoid6(),
      kind: "text",
      x: 40, y: 40,
      text: generation?.notes?.trim() || analysis.title || "Название товара",
      fontSize: 32,
      fill: "#ffffff",
      bold: true,
      width: CANVAS_W - 80,
    });
    (analysis.benefits || []).slice(0, 4).forEach((b, i) => {
      initial.push({
        id: nanoid6(),
        kind: "badge",
        x: 40,
        y: 120 + i * 64,
        text: b,
        fontSize: 16,
        fill: "#ffffff",
        bgColor: "#7c3aed",
        width: 320,
      });
    });
    if (analysis.callToAction) {
      initial.push({
        id: nanoid6(),
        kind: "cta",
        x: 40,
        y: CANVAS_H - 100,
        text: analysis.callToAction,
        fontSize: 18,
        fill: "#ffffff",
        bgColor: "#059669",
        width: 240,
      });
    }
    setElements(legacySavedElementStyles ? applyElementStyles(initial, legacySavedElementStyles) : initial);
    setEditorInitialized(true);
  }, [analysis, appearanceLoaded, editorInitialized, generation, legacySavedElementStyles, savedElements]);

  useEffect(() => {
    if (!id || !editorInitialized || typeof indexedDB === "undefined") return;
    pendingAppearanceRef.current = {
      cardId: id,
      appearance: {
        backgroundMode,
        backgroundColor,
        customBackgroundUrl,
        elements,
      },
    };
    if (appearanceSaveTimeoutRef.current !== null) {
      window.clearTimeout(appearanceSaveTimeoutRef.current);
    }
    appearanceSaveTimeoutRef.current = window.setTimeout(flushPendingAppearance, 250);

    return () => {
      if (appearanceSaveTimeoutRef.current !== null) {
        window.clearTimeout(appearanceSaveTimeoutRef.current);
        appearanceSaveTimeoutRef.current = null;
      }
    };
  }, [backgroundColor, backgroundMode, customBackgroundUrl, editorInitialized, elements, id, toast]);

  useEffect(() => {
    const handlePageHide = () => flushPendingAppearance();
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flushPendingAppearance();
    };
  }, [id]);

  const resetAppearance = () => {
    const nextElements = (currentAppearanceRef.current.elements ?? []).map((element) => ({
      ...element,
      ...defaultStyleForElement(element),
    }));
    const nextAppearance: SavedCardAppearance = {
      backgroundColor: "#1a1a2e",
      customBackgroundUrl: null,
      backgroundMode: generatedBgSrc ? "generated" : "color",
      elements: nextElements,
    };
    stageAppearance(nextAppearance);
    setBackgroundColor(nextAppearance.backgroundColor);
    setCustomBackgroundUrl(nextAppearance.customBackgroundUrl);
    setBackgroundMode(nextAppearance.backgroundMode);
    setElements(nextElements);
    setSelectedId(null);
    toast({
      title: "Оформление сброшено",
      description: "Восстановлены стандартные фон и цвета элементов.",
    });
  };

  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      if (selectedId) {
        const node = stageRef.current.findOne(`#el-${selectedId}`);
        if (node) {
          transformerRef.current.nodes([node]);
          transformerRef.current.getLayer()?.batchDraw();
        }
      } else {
        transformerRef.current.nodes([]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedId]);

  const snapshotTextLayer = useCallback(() => {
    if (!textLayerRef.current) return;
    const dataUrl = textLayerRef.current.toDataURL({ pixelRatio: 1 });
    setTextLayerSnapshot(dataUrl);
  }, []);

  useEffect(() => {
    if (elements.length > 0) {
      setTimeout(snapshotTextLayer, 200);
    }
  }, [elements, snapshotTextLayer]);

  const addText = () => {
    const el: CanvasElement = {
      id: nanoid6(), kind: "text",
      x: 100, y: 200,
      text: "Новый текст",
      fontSize: 24, fill: "#ffffff", bold: false, width: 300,
    };
    changeElements(prev => [...prev, el]);
    setSelectedId(el.id);
  };

  const addBadge = () => {
    const el: CanvasElement = {
      id: nanoid6(), kind: "badge",
      x: 100, y: 300,
      text: "Преимущество",
      fontSize: 16, fill: "#ffffff", bgColor: "#7c3aed", width: 260,
    };
    changeElements(prev => [...prev, el]);
    setSelectedId(el.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    changeElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const startEdit = (el: CanvasElement) => {
    setIsElementsPanelOpen(true);
    setEditingId(el.id);
    setEditingText(el.text);
  };

  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => {
      editingPanelRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }, [editingId, visualViewportHeight]);

  const finishEdit = () => {
    if (!editingId) return;
    changeElements(prev => prev.map(e => e.id === editingId ? { ...e, text: editingText } : e));
    setEditingId(null);
    setEditingText("");
    setTimeout(snapshotTextLayer, 100);
  };

  const updateEl = (id: string, patch: Partial<CanvasElement>) => {
    changeElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    setTimeout(snapshotTextLayer, 100);
  };

  const updatePos = (id: string, x: number, y: number) => {
    changeElements(prev => prev.map(e => e.id === id ? { ...e, x, y } : e));
  };

  const handleBackgroundUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Нужен файл изображения",
        description: "Выберите PNG, JPG, WEBP или другой файл изображения.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Размер фонового изображения не должен превышать 10 МБ.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const customBackground = reader.result;
        enqueueAppearanceWrite(id, {
          backgroundMode: "image",
          backgroundColor,
          customBackgroundUrl: customBackground,
          elements,
        }).then(() => {
          changeCustomBackgroundUrl(customBackground);
          changeBackgroundMode("image");
        }).catch(() => {
          toast({
            title: "Не удалось сохранить оформление",
            description: "Проверьте доступное место в браузере и попробуйте ещё раз.",
            variant: "destructive",
          });
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: "Не удалось загрузить изображение",
        description: "Попробуйте выбрать файл ещё раз.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    if (!stageRef.current) return;
    const exportFormat = MARKETPLACE_FORMATS.find((format) => format.id === exportFormatId);
    downloadEditorPng(
      stageRef.current,
      transformerRef.current,
      `kardomatik-card-${id}.png`,
      () => document.createElement("a"),
      exportFormat ? { width: exportFormat.width, height: exportFormat.height } : undefined,
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Генерация не найдена</p>
      </div>
    );
  }

  const bgPanelLoading = !!(generation.backgroundTaskId && !generation.backgroundImageUrl);
  const sceneAppearance = getEditorSceneAppearance(
    backgroundMode,
    backgroundColor,
    bgImg,
    elements,
  );
  const panels = [
    {
      label: "Фон",
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      src: generation.backgroundImageUrl,
      loading: bgPanelLoading,
      loadingLabel: "Генерируем фон...",
      unavailable: !generation.backgroundTaskId && !generation.backgroundImageUrl,
    },
    {
      label: "Товар без фона",
      icon: <Layers className="w-3.5 h-3.5" />,
      src: removedBgSrc,
      loading: removingBg,
      loadingLabel: "Удаляем фон (~30 сек)...",
      unavailable: false,
    },
    {
      label: "Текстовый слой",
      icon: <Type className="w-3.5 h-3.5" />,
      src: textLayerSnapshot,
      loading: elements.length === 0,
      loadingLabel: "Загрузка...",
      unavailable: false,
    },
    {
      label: "Финальная карточка",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      src: generation.resultImageUrl,
      loading: !generation.resultImageUrl,
      loadingLabel: "Загрузка...",
      unavailable: false,
    },
  ];

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      style={{ minHeight: visualViewportHeight || "100dvh" }}
    >
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0 min-h-11 sm:min-h-0"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm truncate">Редактор карточки</span>
          </div>
          {analysis?.title && (
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex max-w-[200px] truncate">
              {analysis.title}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <ThemeToggle />
            <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={addText} data-testid="button-add-text">
              <Type className="w-3.5 h-3.5 mr-1.5" />
              Текст
            </Button>
            <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={addBadge} data-testid="button-add-badge">
              <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
              Плашка
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={() => setIsBackgroundPanelOpen((open) => !open)}
              data-testid="button-edit-background"
            >
              <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
              Изменить фон
            </Button>
            {selectedId && (
              <Button size="sm" variant="destructive" className="hidden sm:inline-flex" onClick={deleteSelected} data-testid="button-delete">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Удалить
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!isAuth || !hasBalance}
              data-testid="button-download"
              title={!isAuth ? "Скачивание доступно только после авторизации" : !hasBalance ? "Скачивание доступно только после покупки пакета карточек" : undefined}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Скачать</span>
            </Button>
            <MobileMenu isAuth={isAuth} />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-2 sm:gap-4 p-2 sm:p-4 max-w-[1400px] mx-auto w-full min-h-0">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0">
          {panels.map((panel, i) => (
            <div key={i} className="min-w-[112px] flex-1 rounded-lg border border-border bg-card overflow-hidden sm:min-w-0">
              <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-border bg-muted/40">
                {panel.icon}
                <span className="text-[11px] sm:text-xs font-medium text-foreground truncate">{panel.label}</span>
              </div>
              <div className="relative h-16 sm:h-32 flex items-center justify-center bg-muted/20" data-testid={`panel-${i}`}>
                {panel.loading ? (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs text-center px-2">{panel.loadingLabel}</span>
                  </div>
                ) : panel.src ? (
                  <img
                    src={panel.src}
                    alt={panel.label}
                    className="w-full h-full object-contain"
                  />
                ) : panel.unavailable ? (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="w-5 h-5 opacity-40" />
                    <span className="text-xs">Нет изображения</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="w-5 h-5 opacity-40" />
                    <span className="text-xs opacity-60">Нет изображения</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <MarketplaceFormatPanel selected={exportFormatId} onApply={setExportFormatId} />

        <div className="flex flex-col lg:flex-row gap-2 sm:gap-4 flex-1 min-w-0 min-h-0">
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
              <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Canvas редактор</span>
              <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">Двойной клик — редактировать текст</span>
            </div>
            <div
              ref={canvasViewportRef}
              className="h-[min(92vw,55svh)] min-h-[260px] flex-1 min-w-0 overflow-hidden flex items-center justify-center p-2 sm:min-h-[420px] sm:p-4 lg:h-auto"
              data-testid="card-editor-workspace"
            >
              <div
                className="relative shadow-2xl rounded-lg overflow-hidden shrink-0 touch-none"
                data-testid="card-editor-canvas"
                style={{ width: CANVAS_W * canvasScale, height: CANVAS_H * canvasScale }}
              >
                <Stage
                  width={CANVAS_W}
                  height={CANVAS_H}
                  scaleX={canvasScale}
                  scaleY={canvasScale}
                  ref={stageRef}
                  onMouseDown={(e) => {
                    if (e.target === e.target.getStage()) {
                      setSelectedId(null);
                    }
                  }}
                >
                  <Layer>
                    <Rect width={CANVAS_W} height={CANVAS_H} fill={sceneAppearance.backgroundColor} />
                    {sceneAppearance.backgroundImage && (
                      <KonvaImage image={sceneAppearance.backgroundImage} width={CANVAS_W} height={CANVAS_H} />
                    )}
                    {removedBgImg && (
                      <KonvaImage
                        image={removedBgImg}
                        x={CANVAS_W / 2 - 200}
                        y={CANVAS_H / 2 - 200}
                        width={400}
                        height={400}
                        draggable
                        onClick={() => setSelectedId("product-img")}
                        id="el-product-img"
                        onDragEnd={(e) => {}}
                      />
                    )}
                  </Layer>

                  <Layer ref={textLayerRef}>
                    {sceneAppearance.elements.map((el) => (
                      <CanvasElementNode
                        key={el.id}
                        el={el}
                        isSelected={selectedId === el.id}
                        onClick={() => setSelectedId(el.id)}
                        onDblClick={() => startEdit(el)}
                        onDragEnd={(x, y) => {
                          updatePos(el.id, x, y);
                          setTimeout(snapshotTextLayer, 100);
                        }}
                      />
                    ))}
                    <Transformer
                      ref={transformerRef}
                      rotateEnabled={false}
                      boundBoxFunc={(oldBox, newBox) => {
                        if (newBox.width < 50 || newBox.height < 20) return oldBox;
                        return newBox;
                      }}
                    />
                  </Layer>
                </Stage>
              </div>
            </div>
          </div>

          <div
            className="w-full lg:w-72 rounded-lg border border-border bg-card overflow-hidden flex flex-col flex-shrink-0 lg:max-h-none"
            data-testid="card-editor-toolbar"
          >
            <button
              type="button"
              className="px-3 py-2 sm:px-4 sm:py-2.5 border-b border-border bg-muted/40 flex items-center justify-between text-left"
              onClick={() => setIsElementsPanelOpen((open) => !open)}
              aria-expanded={isElementsPanelOpen}
            >
              <span className="text-sm font-medium">Элементы</span>
              {isElementsPanelOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {isElementsPanelOpen && (
            <div className="flex min-h-0 flex-1 flex-col max-h-[48svh] lg:max-h-none">
             <div className="p-2 sm:p-3 border-b border-border space-y-2">
               <Button
                 size="sm"
                 variant={isBackgroundPanelOpen ? "default" : "outline"}
                 className="w-full justify-start min-h-11 sm:min-h-0"
                 onClick={() => setIsBackgroundPanelOpen((open) => !open)}
                 data-testid="sidebar-edit-background"
               >
                 <ImagePlus className="w-3.5 h-3.5 mr-2" />
                 Изменить фон
               </Button>
               {isBackgroundPanelOpen && (
                  <>
                    <BackgroundEditor
                      mode={backgroundMode}
                      color={backgroundColor}
                      customImageUrl={customBackgroundUrl}
                      hasGeneratedBackground={!!generatedBgSrc}
                      onModeChange={changeBackgroundMode}
                      onColorChange={(color) => {
                        changeBackgroundColor(color);
                        changeBackgroundMode("color");
                      }}
                      onUpload={handleBackgroundUpload}
                      onReset={() => {
                        changeCustomBackgroundUrl(null);
                        changeBackgroundMode(generatedBgSrc ? "generated" : "color");
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground"
                      onClick={resetAppearance}
                      data-testid="button-reset-appearance"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-2" />
                      Сбросить всё оформление
                    </Button>
                  </>
               )}
             </div>
            <div
              className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 overscroll-contain"
              data-testid="card-editor-toolbar-scroll"
            >
              {editingId && (
                <div ref={editingPanelRef} className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2 scroll-m-3">
                  <p className="text-xs font-medium text-primary">Редактирование текста</p>
                  <textarea
                    className="w-full text-sm border border-border rounded-md p-2 bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={3}
                    value={editingText}
                    onChange={e => setEditingText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && e.metaKey) finishEdit(); }}
                    autoFocus
                    data-testid="input-edit-text"
                  />
                  <Button size="sm" className="w-full" onClick={finishEdit} data-testid="button-save-text">
                    Сохранить
                  </Button>
                </div>
              )}

              {elements.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Нет элементов. Нажмите "Текст" или "Плашка" в тулбаре.
                </p>
              )}

              {elements.map((el) => (
                <div
                  key={el.id}
                  className={`rounded-md border p-2.5 cursor-pointer transition-colors text-xs ${
                    selectedId === el.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  onClick={() => setSelectedId(el.id)}
                  onDoubleClick={() => startEdit(el)}
                  data-testid={`element-${el.id}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {el.kind === "text" && <Type className="w-3 h-3 text-muted-foreground" />}
                    {el.kind === "badge" && <LayoutTemplate className="w-3 h-3 text-muted-foreground" />}
                    {el.kind === "cta" && <Plus className="w-3 h-3 text-muted-foreground" />}
                    <span className="text-muted-foreground capitalize">{el.kind === "text" ? "Текст" : el.kind === "badge" ? "Плашка" : "Кнопка"}</span>
                    {el.bgColor && (
                      <span className="ml-auto w-3 h-3 rounded-full inline-block border border-border" style={{ backgroundColor: el.bgColor }} />
                    )}
                  </div>
                  <p className="text-foreground font-medium truncate">{el.text}</p>
                </div>
              ))}
            </div>

            {selectedId && (
              <div className="p-2 sm:p-3 border-t border-border space-y-2 sm:space-y-3 overflow-y-auto">
                {(() => {
                  const el = elements.find(e => e.id === selectedId);
                  if (!el) return null;
                  return (
                    <>
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sun className="w-3 h-3" /> Стиль элемента
                      </p>
                      {el.bgColor && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> Прозрачность фона</span>
                            <span className="text-xs text-muted-foreground">{Math.round((el.bgOpacity ?? 0.92) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round((el.bgOpacity ?? 0.92) * 100)}
                            onChange={(e) => updateEl(el.id, { bgOpacity: parseInt(e.target.value) / 100 })}
                            className="w-full h-1 accent-primary"
                          />
                        </div>
                      )}
                      <ColorPalette
                        label="Цвет текста"
                        value={el.fill || "#ffffff"}
                        onChange={(color) => updateEl(el.id, { fill: color })}
                      />
                      {el.bgColor && (
                        <ColorPalette
                          label="Фон плашки"
                          value={el.bgColor}
                          onChange={(color) => updateEl(el.id, { bgColor: color })}
                        />
                      )}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Droplet className="w-3 h-3" /> Цвет тени</span>
                          <input
                            type="color"
                            value={el.shadowColor?.startsWith("#") ? el.shadowColor : "#000000"}
                            onChange={(e) => updateEl(el.id, { shadowColor: e.target.value })}
                            className="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Aperture className="w-3 h-3" /> Размытие</span>
                          <span className="text-xs text-muted-foreground">{el.shadowBlur ?? (el.bgColor ? 6 : 4)}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={el.shadowBlur ?? (el.bgColor ? 6 : 4)}
                          onChange={(e) => updateEl(el.id, { shadowBlur: parseInt(e.target.value) })}
                          className="w-full h-1 accent-primary"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="w-3 h-3" /> Насыщенность тени</span>
                          <span className="text-xs text-muted-foreground">{Math.round((el.shadowOpacity ?? 1) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((el.shadowOpacity ?? 1) * 100)}
                          onChange={(e) => updateEl(el.id, { shadowOpacity: parseInt(e.target.value) / 100 })}
                          className="w-full h-1 accent-primary"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Move className="w-3 h-3" /> Смещение X</span>
                          <span className="text-xs text-muted-foreground">{el.shadowOffsetX ?? 0}px</span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          value={el.shadowOffsetX ?? 0}
                          onChange={(e) => updateEl(el.id, { shadowOffsetX: parseInt(e.target.value) })}
                          className="w-full h-1 accent-primary"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><Move className="w-3 h-3" /> Смещение Y</span>
                          <span className="text-xs text-muted-foreground">{el.shadowOffsetY ?? (el.bgColor ? 2 : 1)}px</span>
                        </div>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          value={el.shadowOffsetY ?? (el.bgColor ? 2 : 1)}
                          onChange={(e) => updateEl(el.id, { shadowOffsetY: parseInt(e.target.value) })}
                          className="w-full h-1 accent-primary"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="p-2 sm:p-3 border-t border-border grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              <Button size="sm" variant="outline" className="w-full justify-start min-h-11 sm:min-h-0" onClick={addText} data-testid="sidebar-add-text">
                <Type className="w-3.5 h-3.5 mr-2" />
                Добавить текст
              </Button>
              <Button size="sm" variant="outline" className="w-full justify-start min-h-11 sm:min-h-0" onClick={addBadge} data-testid="sidebar-add-badge">
                <LayoutTemplate className="w-3.5 h-3.5 mr-2" />
                Добавить плашку
              </Button>
              {selectedId && (
                <Button size="sm" variant="destructive" className="w-full justify-start min-h-11 sm:min-h-0" onClick={deleteSelected} data-testid="sidebar-delete">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Удалить выбранный
                </Button>
              )}
            </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackgroundEditor({
  mode,
  color,
  customImageUrl,
  hasGeneratedBackground,
  onModeChange,
  onColorChange,
  onUpload,
  onReset,
}: {
  mode: BackgroundMode;
  color: string;
  customImageUrl: string | null;
  hasGeneratedBackground: boolean;
  onModeChange: (mode: BackgroundMode) => void;
  onColorChange: (color: string) => void;
  onUpload: (file: File | undefined) => void;
  onReset: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="rounded-md border border-border bg-background p-2.5 space-y-3"
      data-testid="background-editor"
      data-background-mode={mode}
      data-background-color={color}
      data-has-custom-background={customImageUrl ? "true" : "false"}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onModeChange("color")}
          className={`rounded-md border px-2 py-2 text-[11px] font-medium transition-colors ${
            mode === "color"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50"
          }`}
          data-testid="background-mode-color"
        >
          <span className="mx-auto mb-1 block h-6 w-6 rounded-full border border-border" style={{ backgroundColor: color }} />
          Однотонный цвет
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-md border px-2 py-2 text-[11px] font-medium transition-colors ${
            mode === "image"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:border-primary/50"
          }`}
          data-testid="background-mode-image"
        >
          {customImageUrl ? (
            <img src={customImageUrl} alt="" className="mx-auto mb-1 h-6 w-6 rounded object-cover" />
          ) : (
            <Upload className="mx-auto mb-1 h-6 w-6 p-1 text-muted-foreground" />
          )}
          Загрузить фото
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onUpload(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
        data-testid="input-background-image"
      />

      {mode === "color" && (
        <ColorPalette label="Цвет фона" value={color} onChange={onColorChange} />
      )}

      {mode === "image" && customImageUrl && (
        <div className="overflow-hidden rounded-md border border-border">
          <img
            src={customImageUrl}
            alt="Предпросмотр фонового изображения"
            className="h-24 w-full object-cover"
            data-testid="custom-background-preview"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {hasGeneratedBackground && (
          <button
            type="button"
            onClick={() => onModeChange("generated")}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              mode === "generated"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
            data-testid="background-mode-generated"
          >
            Вернуть AI-фон
          </button>
        )}
        {(mode !== "generated" || customImageUrl) && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
            data-testid="button-reset-background"
          >
            <RotateCcw className="h-3 w-3" />
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
}

function ColorPalette({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [inputError, setInputError] = useState(false);

  useEffect(() => {
    setDraft(value);
    setInputError(false);
  }, [value]);

  const applyDraft = () => {
    const normalized = normalizeColor(draft);
    if (!normalized) {
      setInputError(true);
      return;
    }
    setDraft(normalized);
    setInputError(false);
    onChange(normalized);
  };

  return (
    <div className="space-y-1.5" data-testid={`color-palette-${label}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <label className="editor-color-input-wrap" title="Выбрать цвет">
          <input
            type="color"
            value={normalizeColor(value) || "#ffffff"}
            onChange={(event) => {
              setDraft(event.target.value);
              setInputError(false);
              onChange(event.target.value);
            }}
            className="editor-color-input"
            aria-label={`${label}: выбор цвета`}
          />
        </label>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {EDITOR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`editor-color-swatch ${normalizeColor(value) === color ? "is-selected" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => {
              setDraft(color);
              setInputError(false);
              onChange(color);
            }}
            aria-label={`${label}: ${color}`}
            title={color}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInputError(false);
          }}
          onBlur={applyDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyDraft();
            }
          }}
          placeholder="#7c3aed или rgb(124, 58, 237)"
          className={`min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary ${
            inputError ? "border-destructive" : "border-border"
          }`}
          aria-label={`${label}: HEX или RGB`}
          data-testid={`input-${label}-custom-color`}
        />
        {inputError && <span className="text-[10px] text-destructive">HEX/RGB</span>}
      </div>
    </div>
  );
}

function MarketplaceFormatPanel({
  selected,
  onApply,
}: {
  selected: MarketplaceFormatId;
  onApply: (format: MarketplaceFormatId) => void;
}) {
  const [pending, setPending] = useState<MarketplaceFormatId>(selected);
  const { toast } = useToast();

  const handleApply = () => {
    const fmt = MARKETPLACE_FORMATS.find((f) => f.id === pending);
    if (!fmt) return;
    onApply(fmt.id);
    toast({
      title: `Формат ${fmt.name} применён`,
      description: `${fmt.width}×${fmt.height} px (${fmt.ratio})${fmt.hint ? " · " + fmt.hint : ""}`,
    });
  };

  const selectedFmt = MARKETPLACE_FORMATS.find((f) => f.id === pending);

  return (
    <div className="rounded-lg border border-border bg-card p-2 sm:p-4">
      <div className="flex items-center justify-between mb-2 sm:mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Crop className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Формат маркетплейса</span>
        </div>
        {selectedFmt && (
          <button
            onClick={handleApply}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors"
            data-testid="button-apply-format"
          >
            Применить формат
          </button>
        )}
      </div>
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:pb-0">
        {MARKETPLACE_FORMATS.map((fmt) => (
          <button
            key={fmt.id}
            onClick={() => setPending(fmt.id)}
            data-testid={`format-${fmt.id}`}
            className={`flex w-[112px] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-xs transition-all sm:w-auto sm:min-w-[90px] sm:gap-1 sm:px-3 sm:py-2 ${
              pending === fmt.id
                ? "border-primary bg-primary/5 ring-1 ring-primary text-foreground"
                : "border-border bg-muted/20 hover:border-primary/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-semibold text-foreground text-sm leading-tight">{fmt.name}</span>
            <span className="text-primary font-medium">{fmt.ratio}</span>
            <span className="text-[10px] text-muted-foreground">{fmt.width}×{fmt.height}</span>
          </button>
        ))}
      </div>
      {selectedFmt?.hint && (
        <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">{selectedFmt.hint}</p>
      )}
    </div>
  );
}

function CanvasElementNode({
  el,
  isSelected,
  onClick,
  onDblClick,
  onDragEnd,
}: {
  el: CanvasElement;
  isSelected: boolean;
  onClick: () => void;
  onDblClick: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const nodeRef = useRef<Konva.Group>(null);
  const PAD_X = 12;
  const PAD_Y = 8;
  const w = el.width || 300;
  const fontSize = el.fontSize || 20;
  const lineHeight = fontSize * 1.3;
  const approxLines = Math.ceil((el.text.length * (fontSize * 0.55)) / (w - PAD_X * 2));
  const textH = Math.max(lineHeight, approxLines * lineHeight);
  const boxH = el.bgColor ? textH + PAD_Y * 2 : textH;

  return (
    <Group
      id={`el-${el.id}`}
      ref={nodeRef}
      x={el.x}
      y={el.y}
      draggable
      onClick={onClick}
      onTap={onClick}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    >
      {el.bgColor && (
        <Rect
          width={w}
          height={boxH}
          fill={el.bgColor}
          cornerRadius={el.kind === "cta" ? 8 : 6}
          opacity={el.bgOpacity ?? 0.92}
          shadowColor={el.shadowColor || "rgba(0,0,0,0.3)"}
          shadowBlur={el.shadowBlur ?? 6}
          shadowOffsetX={el.shadowOffsetX ?? 0}
          shadowOffsetY={el.shadowOffsetY ?? 2}
          shadowOpacity={el.shadowOpacity ?? 1}
        />
      )}
      <Text
        x={el.bgColor ? PAD_X : 0}
        y={el.bgColor ? PAD_Y : 0}
        width={el.bgColor ? w - PAD_X * 2 : w}
        text={el.text}
        fontSize={fontSize}
        fontFamily="sans-serif"
        fontStyle={el.bold ? "bold" : "normal"}
        fill={el.fill || "#ffffff"}
        lineHeight={1.3}
        wrap="word"
        shadowColor={el.shadowColor || "rgba(0,0,0,0.5)"}
        shadowBlur={el.shadowBlur ?? (el.bgColor ? 0 : 4)}
        shadowOffsetX={el.shadowOffsetX ?? 0}
        shadowOffsetY={el.shadowOffsetY ?? (el.bgColor ? 0 : 1)}
        shadowOpacity={el.shadowOpacity ?? 1}
      />
    </Group>
  );
}

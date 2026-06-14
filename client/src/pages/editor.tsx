import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Stage, Layer, Image as KonvaImage, Text, Rect, Transformer, Group } from "react-konva";
import type { Generation, GptAnalysis } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import Konva from "konva";

const CANVAS_W = 800;
const CANVAS_H = 800;

type ElementKind = "text" | "badge" | "cta";

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

  const analysis = generation?.gptAnalysis as GptAnalysis | null;

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedRef = useRef<Konva.Node | null>(null);

  const bgImg = useKonvaImage(proxyUrl(generation?.backgroundImageUrl));
  const cardImg = useKonvaImage(proxyUrl(generation?.resultImageUrl));
  const { result: removedBgSrc, loading: removingBg } = useRemovedBgImage(
    generation?.originalImageUrl?.startsWith("data:") ? generation.originalImageUrl : null
  );
  const removedBgImg = useKonvaImage(removedBgSrc);

  const textLayerRef = useRef<Konva.Layer>(null);
  const [textLayerSnapshot, setTextLayerSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!analysis || elements.length > 0) return;
    const initial: CanvasElement[] = [];
    initial.push({
      id: nanoid6(),
      kind: "text",
      x: 40, y: 40,
      text: analysis.title || "Название товара",
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
    setElements(initial);
  }, [analysis]);

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
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  };

  const addBadge = () => {
    const el: CanvasElement = {
      id: nanoid6(), kind: "badge",
      x: 100, y: 300,
      text: "Преимущество",
      fontSize: 16, fill: "#ffffff", bgColor: "#7c3aed", width: 260,
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const startEdit = (el: CanvasElement) => {
    setEditingId(el.id);
    setEditingText(el.text);
  };

  const finishEdit = () => {
    if (!editingId) return;
    setElements(prev => prev.map(e => e.id === editingId ? { ...e, text: editingText } : e));
    setEditingId(null);
    setEditingText("");
    setTimeout(snapshotTextLayer, 100);
  };

  const updatePos = (id: string, x: number, y: number) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, x, y } : e));
  };

  const handleDownload = () => {
    if (!stageRef.current) return;
    setSelectedId(null);
    setTimeout(() => {
      const uri = stageRef.current!.toDataURL({ pixelRatio: 2 });
      const a = document.createElement("a");
      a.download = `kardomatik-card-${id}.png`;
      a.href = uri;
      a.click();
    }, 100);
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">Редактор карточки</span>
          </div>
          {analysis?.title && (
            <Badge variant="secondary" className="text-xs hidden sm:inline-flex max-w-[200px] truncate">
              {analysis.title}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={addText} data-testid="button-add-text">
              <Type className="w-3.5 h-3.5 mr-1.5" />
              Текст
            </Button>
            <Button size="sm" variant="outline" onClick={addBadge} data-testid="button-add-badge">
              <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
              Плашка
            </Button>
            {selectedId && (
              <Button size="sm" variant="destructive" onClick={deleteSelected} data-testid="button-delete">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Удалить
              </Button>
            )}
            <Button size="sm" onClick={handleDownload} data-testid="button-download">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Скачать
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col gap-4 p-3 sm:p-4 max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {panels.map((panel, i) => (
            <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40">
                {panel.icon}
                <span className="text-xs font-medium text-foreground">{panel.label}</span>
              </div>
              <div className="relative h-32 flex items-center justify-center bg-muted/20" data-testid={`panel-${i}`}>
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

        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 flex-1">
          <div className="flex-1 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2">
              <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Canvas редактор</span>
              <span className="text-xs text-muted-foreground ml-auto">Двойной клик — редактировать текст</span>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              <div className="relative shadow-2xl rounded-lg overflow-hidden" style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: "100%" }}>
                <Stage
                  width={CANVAS_W}
                  height={CANVAS_H}
                  ref={stageRef}
                  onMouseDown={(e) => {
                    if (e.target === e.target.getStage()) {
                      setSelectedId(null);
                    }
                  }}
                >
                  <Layer>
                    <Rect width={CANVAS_W} height={CANVAS_H} fill="#1a1a2e" />
                    {bgImg && (
                      <KonvaImage image={bgImg} width={CANVAS_W} height={CANVAS_H} />
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
                    {elements.map((el) => (
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

          <div className="w-full lg:w-72 rounded-lg border border-border bg-card overflow-hidden flex flex-col hidden sm:flex">
            <div className="px-4 py-2.5 border-b border-border bg-muted/40">
              <span className="text-sm font-medium">Элементы</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {editingId && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
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

            <div className="p-3 border-t border-border space-y-1.5">
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={addText} data-testid="sidebar-add-text">
                <Type className="w-3.5 h-3.5 mr-2" />
                Добавить текст
              </Button>
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={addBadge} data-testid="sidebar-add-badge">
                <LayoutTemplate className="w-3.5 h-3.5 mr-2" />
                Добавить плашку
              </Button>
              {selectedId && (
                <Button size="sm" variant="destructive" className="w-full justify-start" onClick={deleteSelected} data-testid="sidebar-delete">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Удалить выбранный
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
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
          opacity={0.92}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={6}
          shadowOffsetY={2}
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
        shadowColor="rgba(0,0,0,0.5)"
        shadowBlur={el.bgColor ? 0 : 4}
        shadowOffsetY={el.bgColor ? 0 : 1}
      />
    </Group>
  );
}

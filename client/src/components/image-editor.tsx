import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Group, Rect, Transformer } from "react-konva";
import Konva from "konva";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Download, Type, Trash2, ChevronDown, ChevronUp, Check, Minus, Plus, Sparkles, Loader2, Image as ImageIcon, Star } from "lucide-react";
import { MODELS, BG_EDIT_STAR_COSTS, type ModelId } from "@shared/schema";

interface EditorElement {
  id: string;
  type: "text" | "badge";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontStyle: string;
  fill: string;
  bgFill: string;
  padding: number;
  cornerRadius: number;
}

const BADGE_TEMPLATES: Omit<EditorElement, "id" | "x" | "y">[] = [
  { type: "badge", text: "1 299 ₽", fontSize: 22, fontStyle: "bold", fill: "#ffffff", bgFill: "#ef4444", padding: 12, cornerRadius: 8 },
  { type: "badge", text: "−30%", fontSize: 26, fontStyle: "bold", fill: "#ffffff", bgFill: "#f97316", padding: 12, cornerRadius: 8 },
  { type: "badge", text: "НОВИНКА", fontSize: 18, fontStyle: "bold", fill: "#ffffff", bgFill: "#22c55e", padding: 10, cornerRadius: 6 },
  { type: "badge", text: "ХИТ ПРОДАЖ", fontSize: 18, fontStyle: "bold", fill: "#111111", bgFill: "#facc15", padding: 10, cornerRadius: 6 },
  { type: "badge", text: "Бесплатная доставка", fontSize: 16, fontStyle: "normal", fill: "#ffffff", bgFill: "#3b82f6", padding: 10, cornerRadius: 6 },
  { type: "badge", text: "СКИДКА", fontSize: 18, fontStyle: "bold", fill: "#ffffff", bgFill: "#a855f7", padding: 10, cornerRadius: 6 },
];

const TEXT_COLORS = ["#ffffff", "#000000", "#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
const BG_COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#000000", "#ffffff"];

let elIdCounter = 1;
function newId() { return `el-${elIdCounter++}`; }

function measureTextWidth(text: string, fontSize: number, fontStyle: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${fontStyle === "bold" ? "bold " : ""}${fontSize}px sans-serif`;
  return ctx.measureText(text).width;
}

interface Props {
  imageUrl: string;
  onClose: () => void;
  stars: number;
  onStarsChange?: (n: number) => void;
}

export default function ImageEditor({ imageUrl, onClose, stars, onStarsChange }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 600, height: 600 });
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editPos, setEditPos] = useState({ x: 0, y: 0, w: 200, h: 40 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [bgEditorOpen, setBgEditorOpen] = useState(false);
  const [bgPrompt, setBgPrompt] = useState("");
  const [bgGenerating, setBgGenerating] = useState(false);
  const [bgModel, setBgModel] = useState<ModelId>("nano-banana-pro");
  const [bgSuggesting, setBgSuggesting] = useState(false);
  const [bgSuggestion, setBgSuggestion] = useState<string>("");

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    setLoading(true);

    const load = async () => {
      try {
        const proxyUrl = imageUrl.startsWith("data:")
          ? imageUrl
          : `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;

        let src: string;
        if (imageUrl.startsWith("data:")) {
          src = imageUrl;
        } else {
          const resp = await fetch(proxyUrl);
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          src = objectUrl;
        }

        const img = new window.Image();
        img.onload = () => {
          setBlobUrl(src);
          setImageEl(img);
          setLoading(false);
        };
        img.onerror = () => setLoading(false);
        img.src = src;
      } catch {
        setLoading(false);
      }
    };

    load();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imageUrl]);

  useEffect(() => {
    if (!imageEl || !containerRef.current) return;

    const updateSize = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      const maxW = Math.max(rect.width - 8, 200);
      const maxH = window.innerHeight - 180;
      const ratio = imageEl.naturalWidth / imageEl.naturalHeight;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      setStageSize({ width: Math.round(w), height: Math.round(h) });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [imageEl]);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (!selectedId || editingId) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    const node = stageRef.current.findOne(`#${selectedId}`);
    if (node) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, editingId, elements]);

  const selectedEl = elements.find(e => e.id === selectedId) ?? null;

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) setSelectedId(null);
  };

  const startEdit = useCallback((el: EditorElement) => {
    if (!stageRef.current) return;
    const node = stageRef.current.findOne(`#${el.id}`);
    if (!node) return;

    const absPos = node.getAbsolutePosition();
    const stageBox = stageRef.current.container().getBoundingClientRect();
    const containerBox = containerRef.current!.getBoundingClientRect();

    const offsetX = stageBox.left - containerBox.left;
    const offsetY = stageBox.top - containerBox.top;

    const textW = measureTextWidth(el.text, el.fontSize, el.fontStyle) + el.padding * 2 + 10;
    const textH = el.fontSize + el.padding * 2 + 4;

    setEditPos({
      x: offsetX + absPos.x,
      y: offsetY + absPos.y,
      w: Math.max(textW, 120),
      h: Math.max(textH, 36),
    });
    setEditText(el.text);
    setEditingId(el.id);
    setTimeout(() => editInputRef.current?.focus(), 20);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const text = editText.trim() || "Текст";
    setElements(els => els.map(e => e.id === editingId ? { ...e, text } : e));
    setEditingId(null);
    setSelectedId(editingId);
  }, [editingId, editText]);

  const addText = () => {
    const el: EditorElement = {
      id: newId(), type: "text",
      x: stageSize.width * 0.1, y: stageSize.height * 0.1,
      text: "Ваш текст", fontSize: 28, fontStyle: "bold",
      fill: "#ffffff", bgFill: "transparent", padding: 8, cornerRadius: 0,
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setTimeout(() => startEdit(el), 80);
  };

  const addBadge = (template: typeof BADGE_TEMPLATES[number]) => {
    const el: EditorElement = {
      ...template,
      id: newId(),
      x: stageSize.width * 0.05 + Math.random() * stageSize.width * 0.1,
      y: stageSize.height * 0.05 + Math.random() * stageSize.height * 0.1,
    };
    setElements(prev => [...prev, el]);
    setSelectedId(el.id);
    setTimeout(() => startEdit(el), 80);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  const updateSelected = (patch: Partial<EditorElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(e => e.id === selectedId ? { ...e, ...patch } : e));
  };

  const handleExport = async () => {
    if (!stageRef.current || !imageEl) return;
    setSaving(true);
    try {
      const pixelRatio = imageEl.naturalWidth / stageSize.width;
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: Math.max(pixelRatio, 1) });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "kardomatik-edited.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestBackground = async () => {
    setBgSuggesting(true);
    setBgSuggestion("");
    try {
      const resp = await fetch("/api/suggest-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Ошибка генерации идеи");
      }
      const suggestion = data.suggestion || "";
      setBgSuggestion(suggestion);
      setBgPrompt(suggestion);
    } catch (err: any) {
      alert(err.message || "Ошибка генерации идеи");
    } finally {
      setBgSuggesting(false);
    }
  };

  const handleEditBackground = async () => {
    if (!bgPrompt.trim()) return;
    const cost = BG_EDIT_STAR_COSTS[bgModel];
    if (stars < cost) {
      alert(`Недостаточно звёзд. Нужно ${cost} ⭐ для изменения фона.`);
      return;
    }
    setBgGenerating(true);
    try {
      const resp = await fetch("/api/edit-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl, prompt: bgPrompt.trim(), modelId: bgModel }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Ошибка замены фона");
      }
      // Загружаем новое изображение
      const newImg = new window.Image();
      newImg.crossOrigin = "anonymous";
      newImg.onload = () => {
        setImageEl(newImg);
        setBlobUrl(data.url);
      };
      newImg.src = data.url;
      setBgEditorOpen(false);
      setBgPrompt("");
      setBgSuggestion("");
      onStarsChange?.(stars - cost);
    } catch (err: any) {
      alert(err.message || "Ошибка замены фона");
    } finally {
      setBgGenerating(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background flex-shrink-0">
        <span className="font-semibold text-sm text-foreground">Редактор изображения</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setBgEditorOpen(true)} disabled={bgGenerating}>
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
            {bgGenerating ? "Генерация..." : `Изменить фон ${BG_EDIT_STAR_COSTS[bgModel]} ⭐`}
          </Button>
          {elements.length > 0 && (
            <Button size="sm" onClick={handleExport} disabled={saving}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "Сохраняем..." : "Скачать"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            Закрыть
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-3 flex items-start justify-center" ref={containerRef}>
          <div style={{ position: "relative", width: stageSize.width, height: stageSize.height }}>
            {loading ? (
              <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg text-muted-foreground text-sm">
                Загружаем изображение...
              </div>
            ) : imageEl && blobUrl ? (
              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                onClick={handleStageClick}
              >
                <Layer>
                  <KonvaImage
                    image={imageEl}
                    width={stageSize.width}
                    height={stageSize.height}
                  />
                  {elements.map(el => (
                    <ElementNode
                      key={el.id}
                      el={el}
                      isSelected={selectedId === el.id}
                      stageSize={stageSize}
                      onSelect={() => { setSelectedId(el.id); }}
                      onDblClick={() => startEdit(el)}
                      onDragEnd={(x, y) => setElements(prev => prev.map(e => e.id === el.id ? { ...e, x, y } : e))}
                    />
                  ))}
                  <Transformer
                    ref={transformerRef}
                    enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (newBox.width < 20 || newBox.height < 20) return oldBox;
                      return newBox;
                    }}
                    onTransformEnd={() => {
                      if (!stageRef.current || !selectedId) return;
                      const node = stageRef.current.findOne(`#${selectedId}`);
                      if (!node) return;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      const newFontSize = Math.max(10, Math.round((selectedEl?.fontSize ?? 20) * ((scaleX + scaleY) / 2)));
                      setElements(prev => prev.map(e => e.id === selectedId ? { ...e, fontSize: newFontSize, x: node.x(), y: node.y() } : e));
                    }}
                  />
                </Layer>
              </Stage>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg text-destructive text-sm">
                Не удалось загрузить изображение
              </div>
            )}

            {editingId && (
              <textarea
                ref={editInputRef}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === "Escape") commitEdit(); }}
                onBlur={commitEdit}
                style={{
                  position: "absolute",
                  left: editPos.x,
                  top: editPos.y,
                  width: editPos.w,
                  minHeight: editPos.h,
                  fontSize: Math.max((selectedEl?.fontSize ?? 20) * (stageSize.width / (imageEl?.naturalWidth ?? stageSize.width)) * 1.0, 12),
                  background: selectedEl?.bgFill === "transparent" ? "rgba(0,0,0,0.5)" : (selectedEl?.bgFill ?? "rgba(0,0,0,0.5)"),
                  color: selectedEl?.fill ?? "#fff",
                  fontWeight: selectedEl?.fontStyle === "bold" ? "bold" : "normal",
                  border: "2px solid #fff",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  outline: "none",
                  resize: "none",
                  zIndex: 100,
                  lineHeight: "1.3",
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
                rows={1}
              />
            )}
          </div>
        </div>

        <div className="w-64 border-l border-border bg-background flex flex-col flex-shrink-0 overflow-y-auto">
          <button
            className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            onClick={() => setPanelOpen(v => !v)}
          >
            Инструменты
            {panelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {panelOpen && (
            <div className="px-3 pb-4 space-y-4">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={addText}>
                <Type className="w-4 h-4" />
                Добавить текст
              </Button>

              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">Плашки</p>
                <div className="space-y-1.5">
                  {BADGE_TEMPLATES.map((tmpl, i) => (
                    <button
                      key={i}
                      onClick={() => addBadge(tmpl)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                    >
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0"
                        style={{ background: tmpl.bgFill, color: tmpl.fill, fontWeight: tmpl.fontStyle === "bold" ? "bold" : "normal" }}
                      >
                        {tmpl.text.length > 12 ? tmpl.text.slice(0, 12) + "…" : tmpl.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedEl && !editingId && (
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Выбранный элемент</p>

                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => startEdit(selectedEl)}
                  >
                    Редактировать текст
                  </button>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Размер шрифта</p>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted"
                        onClick={() => updateSelected({ fontSize: Math.max(10, (selectedEl.fontSize ?? 20) - 2) })}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{selectedEl.fontSize}</span>
                      <button
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted"
                        onClick={() => updateSelected({ fontSize: Math.min(120, (selectedEl.fontSize ?? 20) + 2) })}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Цвет текста</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEXT_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateSelected({ fill: c })}
                          className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                          style={{ background: c, borderColor: selectedEl.fill === c ? "#6366f1" : "#d1d5db" }}
                        >
                          {selectedEl.fill === c && <Check className="w-3 h-3" style={{ color: c === "#ffffff" ? "#000" : "#fff" }} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedEl.type === "badge" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Цвет фона</p>
                      <div className="flex flex-wrap gap-1.5">
                        {BG_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => updateSelected({ bgFill: c })}
                            className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                            style={{ background: c, borderColor: selectedEl.bgFill === c ? "#6366f1" : "#d1d5db" }}
                          >
                            {selectedEl.bgFill === c && <Check className="w-3 h-3" style={{ color: c === "#ffffff" ? "#000" : "#fff" }} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Скругление углов</p>
                    <div className="flex items-center gap-2">
                      <button
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted"
                        onClick={() => updateSelected({ cornerRadius: Math.max(0, (selectedEl.cornerRadius ?? 0) - 2) })}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{selectedEl.cornerRadius}</span>
                      <button
                        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-muted"
                        onClick={() => updateSelected({ cornerRadius: Math.min(60, (selectedEl.cornerRadius ?? 0) + 2) })}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Стиль</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateSelected({ fontStyle: "bold" })}
                        className={`flex-1 h-7 rounded text-xs font-bold border ${selectedEl.fontStyle === "bold" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >
                        Ж
                      </button>
                      <button
                        onClick={() => updateSelected({ fontStyle: "normal" })}
                        className={`flex-1 h-7 rounded text-xs border ${selectedEl.fontStyle === "normal" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                      >
                        Обычный
                      </button>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </Button>
                </div>
              )}

              {elements.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Добавьте текст или плашку,<br />затем перетащите на нужное место
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {bgEditorOpen && (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Изменение фона</h3>
            <button onClick={() => setBgEditorOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Опишите новый фон на естественном языке. Например: «белый бесшовный фон, студийное освещение»
            </p>
            <button
              onClick={handleSuggestBackground}
              disabled={bgSuggesting || bgGenerating}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
            >
              {bgSuggesting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Идея...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  ИИ подбирает фон
                </>
              )}
            </button>
          </div>
          <textarea
            value={bgPrompt}
            onChange={e => setBgPrompt(e.target.value)}
            rows={3}
            placeholder="Белый бесшовный фон, студийное освещение..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Модель</p>
            <div className="flex gap-1.5">
              {MODELS.map((m) => {
                const isSelected = bgModel === m.id;
                const canAfford = stars >= BG_EDIT_STAR_COSTS[m.id];
                return (
                  <button
                    key={m.id}
                    onClick={() => setBgModel(m.id)}
                    disabled={bgGenerating}
                    className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
                      isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-muted/30 hover:border-primary/40"
                    } ${!canAfford ? "opacity-60" : ""}`}
                  >
                    <span className="font-semibold text-foreground leading-tight text-center mb-0.5">{m.name}</span>
                    <span className="text-amber-500 font-medium">{BG_EDIT_STAR_COSTS[m.id]} ⭐</span>
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {(() => {
                const m = MODELS.find((x) => x.id === bgModel);
                if (!m) return null;
                return (
                  <>
                    <p className="text-emerald-600">✅ {m.pros}</p>
                    <p className="text-rose-500">⚠️ {m.cons}</p>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setBgEditorOpen(false)} disabled={bgGenerating}>
              Отмена
            </Button>
            <Button className="flex-1" onClick={handleEditBackground} disabled={bgGenerating || !bgPrompt.trim()}>
              {bgGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Генерация...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />{BG_EDIT_STAR_COSTS[bgModel]} ⭐</>
              )}
            </Button>
          </div>
        </Card>
      </div>
    )}
    </>
  );
}

interface ElementNodeProps {
  el: EditorElement;
  isSelected: boolean;
  stageSize: { width: number; height: number };
  onSelect: () => void;
  onDblClick: () => void;
  onDragEnd: (x: number, y: number) => void;
}

function ElementNode({ el, isSelected, stageSize, onSelect, onDblClick, onDragEnd }: ElementNodeProps) {
  const textWidth = measureTextWidth(el.text, el.fontSize, el.fontStyle);
  const totalW = textWidth + el.padding * 2;
  const totalH = el.fontSize * 1.2 + el.padding * 2;

  const commonProps = {
    id: el.id,
    x: el.x,
    y: el.y,
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDblClick: onDblClick,
    onDblTap: onDblClick,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      onDragEnd(node.x(), node.y());
    },
  };

  if (el.type === "badge") {
    return (
      <Group {...commonProps} opacity={isSelected ? 0.85 : 1}>
        <Rect
          width={totalW}
          height={totalH}
          fill={el.bgFill}
          cornerRadius={el.cornerRadius}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={6}
          shadowOffsetX={1}
          shadowOffsetY={2}
        />
        <Text
          text={el.text}
          x={el.padding}
          y={el.padding}
          fontSize={el.fontSize}
          fontStyle={el.fontStyle}
          fill={el.fill}
          fontFamily="sans-serif"
          listening={false}
        />
      </Group>
    );
  }

  return (
    <Text
      {...commonProps}
      text={el.text}
      fontSize={el.fontSize}
      fontStyle={el.fontStyle}
      fill={el.fill}
      fontFamily="sans-serif"
      opacity={isSelected ? 0.85 : 1}
      shadowColor="rgba(0,0,0,0.6)"
      shadowBlur={4}
      shadowOffsetX={1}
      shadowOffsetY={1}
    />
  );
}

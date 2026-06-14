import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Generation, GptAnalysis } from "@shared/schema";
import { Loader2, CheckCircle2, AlertCircle, Clock, Video, Camera } from "lucide-react";

interface GenerationCardProps {
  generation: Generation;
  isActive: boolean;
  onClick: () => void;
}

const statusConfig = {
  pending: { label: "Ожидание", icon: Clock, color: "text-muted-foreground" },
  analyzing: { label: "Анализ", icon: Loader2, color: "text-primary", spin: true },
  uploading: { label: "Загрузка", icon: Loader2, color: "text-primary", spin: true },
  generating: { label: "Генерация", icon: Loader2, color: "text-primary", spin: true },
  done: { label: "Готово", icon: CheckCircle2, color: "text-green-500" },
  error: { label: "Ошибка", icon: AlertCircle, color: "text-destructive" },
};

export default function GenerationCard({ generation, isActive, onClick }: GenerationCardProps) {
  const status = statusConfig[generation.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const Icon = status.icon;
  const analysis = generation.gptAnalysis as GptAnalysis | null;
  const genType = (generation as any).generationType as string | undefined;
  const isVideo = genType === "video";
  const isTryon = genType === "tryon";

  const fallbackTitle = isVideo ? "Видео товара" : isTryon ? "Примерка одежды" : "Карточка товара";
  const TypeIcon = isVideo ? Video : isTryon ? Camera : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-all hover-elevate",
        isActive
          ? "border-primary bg-primary/5"
          : "border-card-border bg-card"
      )}
      data-testid={`card-generation-${generation.id}`}
    >
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
          {generation.resultImageUrl ? (
            isVideo ? (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Video className="w-5 h-5 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={generation.resultImageUrl}
                alt="Результат"
                className="w-full h-full object-cover"
              />
            )
          ) : generation.originalImageUrl && !generation.originalImageUrl.startsWith("data:") ? (
            <img
              src={generation.originalImageUrl}
              alt="Оригинал"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon className={cn("w-4 h-4", status.color, (status as any).spin && "animate-spin")} />
            </div>
          )}
          {TypeIcon && (
            <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-background/80 flex items-center justify-center">
              <TypeIcon className="w-2.5 h-2.5 text-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate mb-1">
            {analysis?.title || fallbackTitle}
          </p>
          <div className="flex items-center gap-1.5">
            <Icon className={cn("w-3 h-3 flex-shrink-0", status.color, (status as any).spin && "animate-spin")} />
            <span className={cn("text-xs", status.color)}>{status.label}</span>
          </div>
          {generation.createdAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(generation.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

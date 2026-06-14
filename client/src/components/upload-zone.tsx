import { useCallback, useState, useRef } from "react";
import { Upload, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  previewUrl: string | null;
  disabled?: boolean;
}

export default function UploadZone({ onFileSelect, previewUrl, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  }, [disabled, onFileSelect]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }, [onFileSelect]);

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  if (previewUrl) {
    return (
      <div className="relative rounded-lg overflow-hidden bg-card border border-card-border aspect-square max-h-96 w-full flex items-center justify-center">
        <img
          src={previewUrl}
          alt="Превью товара"
          className="w-full h-full object-contain"
          data-testid="img-preview"
        />
        <button
          onClick={() => {
            if (!disabled) {
              onFileSelect(null as any);
              if (inputRef.current) inputRef.current.value = "";
            }
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-md bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover-elevate"
          data-testid="button-clear-preview"
          disabled={disabled}
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={handleClick}
          className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border text-xs text-muted-foreground hover-elevate"
          data-testid="button-change-image"
          disabled={disabled}
        >
          <ImagePlus className="w-3 h-3" />
          Изменить
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-file-hidden"
        />
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200",
        "flex flex-col items-center justify-center min-h-64",
        "bg-card border-card-border",
        isDragging && "border-primary bg-primary/5 scale-[1.01]",
        !isDragging && "hover:border-primary/50 hover:bg-primary/3",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      data-testid="upload-zone"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
        data-testid="input-file"
      />
      <div className={cn(
        "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all",
        isDragging ? "bg-primary/20" : "bg-muted"
      )}>
        {isDragging ? (
          <Upload className="w-7 h-7 text-primary" />
        ) : (
          <ImagePlus className="w-7 h-7 text-muted-foreground" />
        )}
      </div>
      <p className="text-base font-semibold text-foreground mb-1">
        {isDragging ? "Отпустите файл" : "Загрузите фото товара"}
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Перетащите сюда или нажмите для выбора
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-1 bg-muted rounded-sm">JPG</span>
        <span className="px-2 py-1 bg-muted rounded-sm">PNG</span>
        <span className="px-2 py-1 bg-muted rounded-sm">WEBP</span>
        <span className="px-2 py-1 bg-muted rounded-sm">до 20 МБ</span>
      </div>
    </div>
  );
}

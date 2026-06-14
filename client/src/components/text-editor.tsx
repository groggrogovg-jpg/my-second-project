import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import type { GptAnalysis } from "@shared/schema";

interface Props {
  analysis: GptAnalysis;
  onClose: () => void;
  onRegenerate: (updated: GptAnalysis) => void;
  isRegenerating: boolean;
}

export default function TextEditor({ analysis, onClose, onRegenerate, isRegenerating }: Props) {
  const [title, setTitle] = useState(analysis.title);
  const [description, setDescription] = useState(analysis.description);
  const [benefits, setBenefits] = useState<string[]>([...(analysis.benefits || [])]);
  const [callToAction, setCallToAction] = useState(analysis.callToAction);

  const addBenefit = () => setBenefits(prev => [...prev, "Новое преимущество"]);
  const removeBenefit = (i: number) => setBenefits(prev => prev.filter((_, idx) => idx !== i));
  const updateBenefit = (i: number, val: string) =>
    setBenefits(prev => prev.map((b, idx) => idx === i ? val : b));

  const handleRegenerate = () => {
    onRegenerate({
      title,
      description,
      benefits,
      callToAction,
      designStyle: analysis.designStyle,
      prompt: analysis.prompt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Редактирование текста</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Измените текст, затем нажмите «Перегенерировать» — карточка будет создана заново с новым текстом
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Название</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Описание</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Преимущества</label>
            <button
              onClick={addBenefit}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" />Добавить
            </button>
          </div>
          <div className="space-y-1.5">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={b}
                  onChange={e => updateBenefit(i, e.target.value)}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => removeBenefit(i)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Призыв к действию</label>
          <input
            value={callToAction}
            onChange={e => setCallToAction(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isRegenerating}
          >
            Отмена
          </Button>
          <Button
            className="flex-1"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Генерация...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Перегенерировать</>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

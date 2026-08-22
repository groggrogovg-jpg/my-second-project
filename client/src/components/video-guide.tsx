import { ArrowRight, PlayCircle } from "lucide-react";
import { Link } from "wouter";

export default function VideoGuide() {
  return (
    <section
      id="video-guide"
      className="bg-muted/30 border-y border-border py-10 sm:py-16"
    >
      <div className="max-w-[800px] mx-auto px-3 sm:px-6">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-primary/20">
            <PlayCircle className="w-3.5 h-3.5" />
            Видео-презентация
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Как пользоваться сервисом
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Посмотрите короткую инструкцию: регистрация, выбор пакета,
            генерация карточки и скачивание готового результата.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-2 sm:p-3 shadow-sm">
          <video
            className="block w-full aspect-video rounded-xl bg-black object-contain"
            controls
            preload="metadata"
            playsInline
            aria-label="Видео-инструкция по использованию КардоМатик"
          >
            <source src="/videos/guide.mp4" type="video/mp4" />
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        </div>

        <div className="mt-6 text-center">
          <Link href="/app">
            <button
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              data-testid="button-video-guide-cta"
            >
              Начать использовать
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
import { Link } from "wouter";
import { Sparkles, ArrowRight, Upload, Settings2, ImageDown, CheckCircle2, Layers, Shirt, Wand2, Mail, MessageCircle, Phone } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">КардоМатик</span>
            <span className="text-xs text-muted-foreground hidden md:block">ИИ-генератор карточек</span>
          </div>
          <nav className="flex items-center gap-4">
            <a href="#before-after" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Примеры
            </a>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Тарифы
            </Link>
            <a href="https://t.me/KardoMatik_bot" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Поддержка
            </a>
            <Link href="/app">
              <button className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                Попробовать
              </button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-3 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-primary/20">
            <Sparkles className="w-3 h-3" />
            ИИ для маркетплейсов
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Создавайте продающие
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              карточки товаров с ИИ
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Для Ozon, Wildberries и Яндекс Маркет. Профессиональный результат за минуты — без дизайнера.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <Link href="/app">
              <button
                className="flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3 rounded-xl text-base font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5"
                data-testid="button-start-free"
              >
                Начать бесплатно
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#how-it-works">
              <button className="flex items-center gap-2 border border-border bg-background text-foreground px-7 py-3 rounded-xl text-base font-medium hover:bg-muted/50 transition-all">
                Как это работает
              </button>
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
            {["5 карточек бесплатно", "Без навыков дизайна", "Готово за 2 минуты"].map((label) => (
              <span key={label} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="bg-muted/30 border-y border-border py-10 sm:py-16">
          <div className="max-w-6xl mx-auto px-3 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Как это работает</h2>
              <p className="text-muted-foreground">Три простых шага до профессиональной карточки товара</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                {
                  num: "01",
                  icon: <Upload className="w-6 h-6 text-primary" />,
                  title: "Загрузите фото",
                  desc: "Сфотографируйте товар на любом фоне — ИИ сам разберётся с остальным",
                },
                {
                  num: "02",
                  icon: <Settings2 className="w-6 h-6 text-primary" />,
                  title: "Настройте параметры",
                  desc: "Выберите модель ИИ, добавьте описание преимуществ и формат карточки",
                },
                {
                  num: "03",
                  icon: <ImageDown className="w-6 h-6 text-primary" />,
                  title: "Получите карточку",
                  desc: "Скачайте готовое изображение и сразу загружайте на маркетплейс",
                },
              ].map((step) => (
                <div key={step.num} className="bg-background rounded-2xl border border-border p-6 flex flex-col items-center text-center gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      {step.icon}
                    </div>
                    <span className="absolute -top-2 -right-2 text-xs font-bold text-primary/60 bg-background border border-primary/20 rounded-full w-6 h-6 flex items-center justify-center leading-none">
                      {step.num.replace("0", "")}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="before-after" className="max-w-6xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-primary/20">
              <Sparkles className="w-3 h-3" />
              Реальные примеры
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">До и После</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Смотрите, как обычное фото превращается в профессиональную карточку маркетплейса
            </p>
          </div>

          <div className="space-y-8">
            {/* Пример 1 — спрей для волос с реальным фото */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center">
              <div className="space-y-2">
                <div className="rounded-xl border border-border bg-muted/40 aspect-square overflow-hidden">
                  <img
                    src="/before-spray.jpg"
                    alt="Спрей для волос — обычное фото"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground font-medium">До</p>
              </div>
              <div className="space-y-2 relative">
                <div className="rounded-xl border-2 border-primary/40 aspect-square overflow-hidden relative">
                  <img
                    src="/after-spray.jpg"
                    alt="Спрей для волос — профессиональная карточка WB"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 z-10">
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md font-medium">КардоМатик</span>
                  </div>
                </div>
                <p className="text-xs text-center text-primary font-semibold">После ✨</p>
              </div>
            </div>

            {/* Пример 2 — плейсхолдер */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center">
              <div className="space-y-2">
                <div className="rounded-xl border border-border bg-muted/40 aspect-square flex flex-col items-center justify-center gap-3 p-6">
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-muted border border-border flex items-center justify-center">
                    <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/40" />
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground text-center">Фото на белом фоне</span>
                </div>
                <p className="text-xs text-center text-muted-foreground font-medium">До</p>
              </div>
              <div className="space-y-2 relative">
                <div className="rounded-xl border-2 border-primary/40 bg-primary/5 aspect-square flex flex-col items-center justify-center gap-3 p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-violet-500/5" />
                  <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center relative z-10">
                    <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-primary/60" />
                  </div>
                  <span className="text-xs sm:text-sm text-foreground text-center font-medium relative z-10">Стильная карточка с инфографикой</span>
                  <div className="absolute bottom-2 right-2 z-10">
                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md font-medium">КардоМатик</span>
                  </div>
                </div>
                <p className="text-xs text-center text-primary font-semibold">После ✨</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-3 bg-muted/50 rounded-xl border border-border px-5 py-3 text-sm text-muted-foreground">
              <span>Попробуйте — загрузите своё фото товара</span>
              <Link href="/app">
                <button className="text-primary font-medium hover:underline underline-offset-2">
                  Создать свою →
                </button>
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Всё что нужно для маркетплейса</h2>
            <p className="text-muted-foreground">Три инструмента в одном приложении</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: <Layers className="w-7 h-7 text-violet-500" />,
                color: "bg-violet-500/10 border-violet-500/20",
                title: "Карточка товара",
                desc: "ИИ анализирует фото и создаёт профессиональную карточку с текстами, инфографикой и идеальным фоном для Wildberries, Ozon и Яндекс Маркет",
                badge: "40–60 ₽",
              },
              {
                icon: <Shirt className="w-7 h-7 text-sky-500" />,
                color: "bg-sky-500/10 border-sky-500/20",
                title: "Примерка одежды",
                desc: "Виртуально наденьте одежду на модель — загрузите фото человека и одежды, ИИ сделает профессиональную фотосессию без съёмки",
                badge: "Скоро",
              },
              {
                icon: <Wand2 className="w-7 h-7 text-emerald-500" />,
                color: "bg-emerald-500/10 border-emerald-500/20",
                title: "Смена фона",
                desc: "Замените фон готовой карточки одним кликом — студийный белый, природа, абстракция или любой другой через текстовый промпт",
                badge: "В редакторе",
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-border bg-background p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${feature.color}`}>
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{feature.badge}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 py-10 sm:py-16">
          <div className="max-w-2xl mx-auto px-3 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Попробуйте прямо сейчас
            </h2>
            <p className="text-white/80 mb-8 text-base">
              5 карточек бесплатно — без регистрации и карты
            </p>
            <Link href="/app">
              <button
                className="inline-flex items-center gap-2 bg-white text-violet-700 px-8 py-3.5 rounded-xl text-base font-bold hover:bg-white/90 transition-all shadow-lg hover:-translate-y-0.5"
                data-testid="button-cta-bottom"
              >
                Начать бесплатно
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </section>

        <section id="contacts" className="max-w-6xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Контакты</h2>
            <p className="text-muted-foreground">Есть вопросы? Мы на связи — ответим быстро</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: <Mail className="w-6 h-6 text-primary" />,
                label: "Email",
                value: "hello@kardomatik.ru",
                href: "mailto:hello@kardomatik.ru",
                desc: "Для общих вопросов",
              },
              {
                icon: <MessageCircle className="w-6 h-6 text-sky-500" />,
                label: "Telegram",
                value: "@KardoMatik_bot",
                href: "https://t.me/KardoMatik_bot",
                desc: "Быстрые ответы",
              },
              {
                icon: <Phone className="w-6 h-6 text-emerald-500" />,
                label: "WhatsApp",
                value: "+7 (999) 000-00-00",
                href: "https://wa.me/79990000000",
                desc: "Звонки и сообщения",
              },
            ].map((contact) => (
              <a
                key={contact.label}
                href={contact.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all group"
                data-testid={`contact-${contact.label.toLowerCase()}`}
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                  {contact.icon}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-0.5">{contact.label}</p>
                  <p className="font-semibold text-foreground text-sm">{contact.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{contact.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary-foreground" />
            </div>
            <span>КардоМатик</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Тарифы</Link>
            <a href="#contacts" className="hover:text-foreground transition-colors">Контакты</a>
          </div>
          <span>© 2025 КардоМатик</span>
        </div>
      </footer>
    </div>
  );
}

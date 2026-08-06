import { Link } from "wouter";
import { Sparkles, ArrowRight, Upload, Settings2, ImageDown, CheckCircle2, Layers, Shirt, Wand2, Mail, MessageCircle, Plus, ArrowRight as ArrowRightSmall, Star } from "lucide-react";
import FAQ from "@/components/FAQ";
import { Header } from "@/components/header";

const TESTIMONIALS = [
  {
    name: "Анна М.",
    role: "Продавец на Wildberries",
    initial: "А",
    color: "bg-violet-600",
    stars: 5,
    text: "Карточки стали выглядеть профессионально, а продажи заметно выросли. Дизайнер больше не нужен!",
  },
  {
    name: "Сергей К.",
    role: "Ozon",
    initial: "С",
    color: "bg-sky-600",
    stars: 5,
    text: "Экономит кучу времени и денег. Фото на телефон превращается в готовый товарный кадр за пару минут.",
  },
  {
    name: "Марина П.",
    role: "Яндекс Маркет",
    initial: "М",
    color: "bg-emerald-600",
    stars: 5,
    text: "Очень удобный интерфейс и отличное качество. Водяной знак на пробной версии — нормально, купила пакет.",
  },
  {
    name: "Дмитрий В.",
    role: "Собственный бренд",
    initial: "Д",
    color: "bg-amber-500",
    stars: 5,
    text: "Быстро, качественно, без лишних заморочек. Теперь обновляю фото всего ассортимента через КардоМатик.",
  },
];

const TRYON_EXAMPLES: { key: string; label: string; src: string; alt: string }[] = [
  { key: "model", label: "Модель", src: "/tryon/model.jpg", alt: "Фото модели для виртуальной примерки" },
  { key: "clothing", label: "Пиджак", src: "/tryon/clothing.jpg", alt: "Пиджак для примерки" },
  { key: "jeans", label: "Юбка", src: "/tryon/jeans.jpg", alt: "Юбка для примерки" },
  { key: "shoes", label: "Обувь", src: "/tryon/shoes.jpg", alt: "Обувь для примерки" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        desktopRight={
          <Link href="/app">
            <button className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Попробовать
            </button>
          </Link>
        }
        mobileExtra={[
          {
            href: "#before-after",
            label: "Примеры",
            onClick: () => document.getElementById("before-after")?.scrollIntoView({ behavior: "smooth" }),
          },
        ]}
      />
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-3 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-primary/20">
            <Sparkles className="w-3 h-3" />
            ИИ для маркетплейсов
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              КардоМатик — создавайте
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              карточки для маркетплейсов за минуты
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Инструмент для фрилансеров и предпринимателей. Экономьте до 90% бюджета и времени.
            Попробуйте бесплатно — 2 карточки и примерка в подарок.
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
            {["2 карточки бесплатно", "Без навыков дизайна", "Готово за 2–3 минуты"].map((label) => (
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

        <section id="audience" className="max-w-6xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Кому подходит КардоМатик</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Делайте больше, тратьте меньше и управляйте созданием карточек прямо на сайте.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-foreground mb-5">Для фрилансеров</h3>
              <ul className="space-y-3">
                {[
                  "Себестоимость карточки — около 55 ₽. Продавайте клиентам за 200–500 ₽ и получайте маржу до 445 ₽.",
                  "Создавайте карточки за 2–3 минуты и берите больше заказов.",
                  "Обрабатывайте заказы любого объёма — 10, 50 или 100 карточек — без помощников.",
                  "Единый стиль для всех клиентов формируется автоматически.",
                  "2 карточки и примерка бесплатно — протестируйте сервис перед покупкой.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
              <h3 className="text-xl font-semibold text-foreground mb-5">Для селлеров и бизнеса</h3>
              <ul className="space-y-3">
                {[
                  "Карточка за 55 ₽ вместо 200–500 ₽ у фрилансеров — снижайте расходы.",
                  "Создавайте карточки самостоятельно и не ждите дизайнера.",
                  "Быстро тестируйте несколько вариантов для A/B-тестов.",
                  "Все инструменты в одном месте: генерация, примерка и смена фона.",
                  "Полный контроль качества — никаких посредников.",
                  "Выводите товары на маркетплейсы быстрее конкурентов.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link href="/app">
              <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                Получить бесплатные карточки
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </section>

        <section className="bg-muted/30 border-y border-border py-10 sm:py-16">
          <div className="max-w-6xl mx-auto px-3 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Рассчитайте свою выгоду</h2>
              <p className="text-muted-foreground">Понятная экономика для фрилансера и селлера</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">
              <div className="rounded-2xl border border-border bg-background p-6">
                <p className="text-sm font-medium text-primary mb-2">Если вы фрилансер</p>
                <p className="text-2xl font-bold text-foreground mb-2">до 25 000 ₽ выручки</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Купив пакет на 50 карточек за 2 790 ₽, вы можете продать их клиентам за 10 000–25 000 ₽.
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-6">
                <p className="text-sm font-medium text-primary mb-2">Если вы селлер</p>
                <p className="text-2xl font-bold text-foreground mb-2">до 90% экономии</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Создавая карточки самостоятельно, вы экономите до 90% бюджета по сравнению с услугами фрилансера.
                </p>
              </div>
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
                <div className="rounded-xl border border-border bg-muted/40 aspect-square overflow-hidden">
                  <img
                    src="/before-boots.jpg"
                    alt="Ботинки — обычное фото"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground font-medium">До</p>
              </div>
              <div className="space-y-2 relative">
                <div className="rounded-xl border-2 border-primary/40 aspect-square overflow-hidden relative">
                  <img
                    src="/after-boots.jpg"
                    alt="Ботинки — профессиональная карточка WB"
                    className="w-full h-full object-cover"
                  />
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

        <section id="tryon-showcase" className="bg-muted/30 border-y border-border py-10 sm:py-16">
          <div className="max-w-6xl mx-auto px-3 sm:px-6">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-1.5 bg-sky-500/10 text-sky-600 text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-sky-500/20">
                <Shirt className="w-3 h-3" />
                Виртуальная примерка
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Наденьте образ на модель без съёмки</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Загрузите фото модели и до 5 вещей — ИИ виртуально примерит их и соберёт готовый образ
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-4 items-center">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                {TRYON_EXAMPLES.map((ex) => (
                  <div key={ex.key} className="space-y-2">
                    <div className="rounded-xl border border-border bg-background aspect-square overflow-hidden relative">
                      <img src={ex.src} alt={ex.alt} className="w-full h-full object-cover" />
                      <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-background/90 border border-border flex items-center justify-center">
                        <Plus className="w-3 h-3 text-sky-600" />
                      </span>
                    </div>
                    <p className="text-xs text-center text-muted-foreground font-medium">{ex.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex lg:flex-col items-center justify-center gap-2 text-sky-600 rotate-90 lg:rotate-0">
                <ArrowRightSmall className="w-6 h-6" />
              </div>

              <div className="space-y-2 max-w-xs mx-auto w-full">
                <div className="rounded-xl border-2 border-sky-500/40 aspect-[2/3] overflow-hidden relative">
                  <img src="/tryon/result.jpg" alt="Готовый образ после виртуальной примерки" className="w-full h-full object-cover object-top" />
                  <div className="absolute bottom-2 right-2 z-10">
                    <span className="text-[10px] bg-sky-600 text-white px-1.5 py-0.5 rounded-md font-medium">КардоМатик</span>
                  </div>
                </div>
                <p className="text-xs text-center text-sky-600 font-semibold">Готовый образ ✨</p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3 bg-background rounded-xl border border-border px-5 py-3 text-sm text-muted-foreground">
                <span>Хотите примерить свою одежду?</span>
                <Link href="/app">
                  <button className="text-sky-600 font-medium hover:underline underline-offset-2" data-testid="button-tryon-showcase-cta">
                    Попробовать примерку →
                  </button>
                </Link>
              </div>
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
                badge: "Новинка",
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

        {/* Отзывы */}
        <section className="max-w-6xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1.5 bg-muted text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-border">
              <MessageCircle className="w-3 h-3" />
              Отзывы наших клиентов
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Что говорят пользователи</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Реальные отзывы продавцов, которые уже создают карточки с КардоМатик
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-background p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${t.color}`}>
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div className="text-sky-600/60 text-2xl font-serif leading-none select-none">❝</div>
                <p className="text-sm text-foreground/80 leading-relaxed -mt-2">{t.text}</p>
              </div>
            ))}
          </div>
        </section>

        <FAQ />

        <section className="bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 py-10 sm:py-16">
          <div className="max-w-2xl mx-auto px-3 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Попробуйте прямо сейчас
            </h2>
            <p className="text-white/80 mb-8 text-base">
              2 карточки и примерка бесплатно — начните создавать на сайте
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {[
              {
                icon: <Mail className="w-6 h-6 text-primary" />,
                label: "Email",
                value: "support@kardomatik.ru",
                href: "mailto:support@kardomatik.ru",
                desc: "Для общих вопросов",
              },
              {
                icon: <MessageCircle className="w-6 h-6 text-sky-500" />,
                label: "Telegram",
                value: "@KardoMatik_bot",
                href: "https://t.me/KardoMatik_bot",
                desc: "Быстрые ответы",
              },
            ].map((contact) => (
              <a
                key={contact.label}
                href={contact.href}
                target={contact.href.startsWith("http") ? "_blank" : undefined}
                rel={contact.href.startsWith("http") ? "noopener noreferrer" : undefined}
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
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Политика конфиденциальности</Link>
          </div>
          <span>© 2025 КардоМатик</span>
        </div>
      </footer>
    </div>
  );
}

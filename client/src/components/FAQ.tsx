import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sparkles } from "lucide-react";

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "q1",
    question: "Как работает генерация карточки товара?",
    answer:
      "Вы загружаете фото товара на любом фоне, добавляете описание и выбираете модель ИИ. Система анализирует изображение, создаёт продающий заголовок, описание и профессиональный визуал карточки — готовый файл PNG можно скачать сразу.",
  },
  {
    id: "q2",
    question: "Сколько карточек я получу бесплатно?",
    answer:
      "При регистрации начисляются 5 бесплатных карточек. Они позволяют оценить качество результата без риска. Водяного знака на платных карточках нет; на бесплатных — есть небольшой знак КардоМатик.",
  },
  {
    id: "q3",
    question: "Для каких маркетплейсов подходят карточки?",
    answer:
      "Карточки оптимизированы для Wildberries, Ozon и Яндекс Маркет. Форматы изображений и соотношения сторон подобраны под требования каждой площадки. Вы можете скачать универсальный PNG и использовать его на любом маркетплейсе.",
  },
  {
    id: "q4",
    question: "В чём разница между Nano Banana 2 и Nano Banana Pro?",
    answer:
      "Nano Banana 2 — быстрая и доступная модель (от 35 ₽/шт) с качеством 1K. Nano Banana Pro — флагманская модель (от 55 ₽/шт) с качеством 2K, более детальной прорисовкой и лучшей передачей текстур. Для большинства категорий товаров рекомендуем Pro.",
  },
  {
    id: "q5",
    question: "Сгорают ли купленные карточки?",
    answer:
      "Нет. Карточки из любого пакета не имеют срока действия — они остаются на вашем балансе до тех пор, пока вы их не используете. Никаких скрытых списаний или автопродлений не существует.",
  },
  {
    id: "q6",
    question: "Что такое виртуальная примерка?",
    answer:
      "Это инструмент для fashion-брендов: вы загружаете фото модели и до 5 предметов одежды, а ИИ виртуально надевает их на модель. Получается профессиональный образ без съёмки — идеально для каталогов на Wildberries и Ozon.",
  },
  {
    id: "q7",
    question: "Как происходит оплата?",
    answer:
      "Мы принимаем банковские карты, SberPay и ЮMoney. Платёж проводится через защищённый шлюз ЮKassa. Никакие данные карты не хранятся на наших серверах. По вопросам оплаты пишите на hello@kardomatik.ru.",
  },
];

export default function FAQ() {
  return (
    <section className="max-w-3xl mx-auto px-3 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-primary/20">
          <Sparkles className="w-3 h-3" />
          FAQ
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Часто задаваемые вопросы
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Если не нашли ответ — напишите нам в{" "}
          <a
            href="https://t.me/KardoMatik_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Telegram
          </a>
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full divide-y divide-border rounded-2xl border border-border bg-background overflow-hidden">
        {FAQ_ITEMS.map((item) => (
          <AccordionItem
            key={item.id}
            value={item.id}
            className="border-0 px-6 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
          >
            <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline hover:text-primary transition-colors py-5">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5 pt-0">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

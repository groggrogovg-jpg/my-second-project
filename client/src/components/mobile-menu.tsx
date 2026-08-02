import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, Sparkles, CreditCard, MessageCircle, User, LogIn, LogOut } from "lucide-react";
import type { ComponentType } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export interface MobileMenuItem {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  external?: boolean;
  onClick?: () => void;
}

interface MobileMenuProps {
  isAuth?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  extraItems?: MobileMenuItem[];
  brandName?: string;
}

export function MobileMenu({
  isAuth,
  onLogin,
  onLogout,
  extraItems = [],
  brandName = "КардоМатик",
}: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const baseItems: MobileMenuItem[] = [
    { href: "/app", label: "Главная", icon: Sparkles },
    { href: "/pricing", label: "Тарифы", icon: CreditCard },
    { href: "https://t.me/KardoMatik_bot", label: "Поддержка", icon: MessageCircle, external: true },
    ...(isAuth ? [{ href: "/profile", label: "Личный кабинет", icon: User }] : []),
    ...extraItems,
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="Открыть меню"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={close}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-[#6C3CE1] to-[#4A00E0] shadow-xl animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
              <span className="font-bold text-white">{brandName}</span>
              <button
                onClick={close}
                className="p-2 text-white rounded-md hover:bg-white/10 transition-colors"
                aria-label="Закрыть меню"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col p-4 gap-1">
              {baseItems.map((item, idx) => {
                const Icon = item.icon;
                const content = (
                  <span className="flex items-center gap-3 text-white text-lg font-medium py-2">
                    {Icon && <Icon className="w-5 h-5" />}
                    {item.label}
                  </span>
                );
                const handleClick = () => {
                  item.onClick?.();
                  close();
                };
                if (item.external) {
                  return (
                    <a
                      key={idx}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleClick}
                    >
                      {content}
                    </a>
                  );
                }
                return (
                  <Link key={idx} href={item.href} onClick={handleClick}>
                    {content}
                  </Link>
                );
              })}
              <ThemeToggle mobile />
              {isAuth ? (
                <button
                  onClick={() => {
                    onLogout?.();
                    close();
                  }}
                  className="flex items-center gap-3 text-red-300 text-lg font-medium py-2"
                >
                  <LogOut className="w-5 h-5" />
                  Выйти
                </button>
              ) : (
                <button
                  onClick={() => {
                    onLogin?.();
                    close();
                  }}
                  className="flex items-center gap-3 text-white text-lg font-medium py-2"
                >
                  <LogIn className="w-5 h-5" />
                  Войти
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

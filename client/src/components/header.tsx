import { Link } from "wouter";
import { Sparkles, ArrowLeft } from "lucide-react";
import { MobileMenu, type MobileMenuItem } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ReactNode } from "react";

interface HeaderProps {
  showBack?: boolean;
  backHref?: string;
  isAuth?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  desktopRight?: ReactNode;
  mobileExtra?: MobileMenuItem[];
  hideDesktopNav?: boolean;
}

export function Header({
  showBack,
  backHref = "/app",
  isAuth,
  onLogin,
  onLogout,
  desktopRight,
  mobileExtra,
  hideDesktopNav,
}: HeaderProps) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Logo / back */}
        <div className="flex items-center gap-2">
          {showBack && (
            <Link href={backHref}>
              <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Назад</span>
              </button>
            </Link>
          )}
          <Link href="/">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-sm leading-tight text-foreground tracking-tight">КардоМатик</h1>
                <p className="text-[10px] text-muted-foreground leading-none">ИИ-генератор карточек</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Desktop navigation */}
        {!hideDesktopNav && (
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Главная
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Тарифы
            </Link>
            <a
              href="https://t.me/KardoMatik_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Поддержка
            </a>
            {isAuth && (
              <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Личный кабинет
              </Link>
            )}
          </nav>
        )}

        {/* Right side (desktop) + mobile menu */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {desktopRight}
          </div>
          <MobileMenu
            isAuth={isAuth}
            onLogin={onLogin}
            onLogout={onLogout}
            extraItems={mobileExtra}
          />
        </div>
      </div>
    </header>
  );
}

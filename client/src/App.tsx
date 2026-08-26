import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FaqChatWidget } from "@/components/faq-chat-widget";
import { ThemeProvider } from "@/context/theme-context";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Home = lazy(() => import("@/pages/home"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Payment = lazy(() => import("@/pages/payment"));
const Profile = lazy(() => import("@/pages/profile"));
const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const DevPage = lazy(() => import("@/pages/dev"));
const Editor = lazy(() => import("@/pages/editor"));
const Admin = lazy(() => import("@/pages/admin"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const VerifyEmail = lazy(() => import("@/pages/verify-email"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const SubscriptionAgreement = lazy(() => import("@/pages/subscription-agreement"));
const FAQ = lazy(() => import("@/components/FAQ"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/app" component={Home} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/legal/subscription-agreement" component={SubscriptionAgreement} />
      <Route path="/faq" component={FAQ} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/payment" component={Payment} />
      <Route path="/profile" component={Profile} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/editor/:id" component={Editor} />
      <Route path="/dev" component={DevPage} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Router />
          </Suspense>
          {!new URLSearchParams(window.location.search).has("faq-source") && <FaqChatWidget />}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import Profile from "@/pages/profile";
import PaymentSuccess from "@/pages/payment-success";
import DevPage from "@/pages/dev";
import Editor from "@/pages/editor";
import Admin from "@/pages/admin";
import ResetPassword from "@/pages/reset-password";
import PrivacyPolicy from "@/pages/privacy-policy";
import SubscriptionAgreement from "@/pages/subscription-agreement";
import { FaqChatWidget } from "@/components/faq-chat-widget";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/app" component={Home} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/legal/subscription-agreement" component={SubscriptionAgreement} />
      <Route path="/pricing" component={Pricing} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <FaqChatWidget />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

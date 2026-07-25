import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AppTooltipProvider } from "./components/common/AppTooltip.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { queryClient } from "./lib/queryClient.ts";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppTooltipProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppTooltipProvider>
      </QueryClientProvider>
    </StrictMode>
  </BrowserRouter>,
);

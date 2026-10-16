import React from "react";
import ReactDOM from "react-dom/client";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./styles.css";
import { App } from "./shell";
import { ApiError, onLeaving } from "./lib";

// Theme before first paint (light by default); no inline script, so the CSP needs no 'unsafe-inline'.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("crm.theme") === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.theme = "light";
}

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // Permission and validation errors are final; only connection/server failures are retried once.
      retry: (count, e) =>
        count < 1 &&
        (!(e instanceof ApiError) || e.status === 0 || e.status >= 500),
    },
    mutations: { retry: 0 },
  },
});

// CRM-5.1: background polling pauses while the page is being left (paused queries do not start a request).
onLeaving((leaving) => onlineManager.setOnline(!leaving && navigator.onLine));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter basename="/crm">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

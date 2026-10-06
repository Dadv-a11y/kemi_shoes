"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring";

/** Capte les erreurs JavaScript non gérées du navigateur et les remonte au backend. */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Erreurs de chargement de ressources tierces (extensions, scripts bloqués) : ignorées.
      if (!event.message || event.message === "Script error.") return;
      reportClientError({ message: event.message, stack: event.error?.stack, kind: "error" });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({ message: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined, kind: "unhandledrejection" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

"use client";

import { Toaster } from "react-hot-toast";

/* The one toast host for every screen. Each screen used to mount its own
 * <Toaster> with its own inline colours; they now all mount this, and the look
 * lives in src/styles/lit/feedback.css (`.lit-toast`) — a small lit window,
 * green-edged for a success and red-edged for an error. */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        className: "lit-toast",
        success: { className: "lit-toast lit-toast--success" },
        error: { className: "lit-toast lit-toast--error" },
      }}
    />
  );
}

import { ref } from "vue";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

const toasts = ref<Toast[]>([]);
let counter = 0;

export function useToast() {
  function push(
    message: string,
    kind: ToastKind = "info",
    ttl = 4000,
    action?: ToastAction,
  ): void {
    const id = ++counter;
    toasts.value = [...toasts.value, { id, kind, message, action }];
    if (ttl > 0) {
      setTimeout(() => dismiss(id), action ? Math.max(ttl, 8000) : ttl);
    }
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  return {
    toasts,
    push,
    dismiss,
    success: (message: string, action?: ToastAction) => push(message, "success", 4000, action),
    error: (message: string) => push(message, "error", 6000),
    info: (message: string, action?: ToastAction) => push(message, "info", 4000, action),
  };
}

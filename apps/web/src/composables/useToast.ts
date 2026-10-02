import { ref } from "vue";

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const toasts = ref<Toast[]>([]);
let counter = 0;

export function useToast() {
  function push(message: string, kind: ToastKind = "info", ttl = 4000): void {
    const id = ++counter;
    toasts.value = [...toasts.value, { id, kind, message }];
    if (ttl > 0) {
      setTimeout(() => dismiss(id), ttl);
    }
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  return {
    toasts,
    push,
    dismiss,
    success: (message: string) => push(message, "success"),
    error: (message: string) => push(message, "error", 6000),
    info: (message: string) => push(message, "info"),
  };
}

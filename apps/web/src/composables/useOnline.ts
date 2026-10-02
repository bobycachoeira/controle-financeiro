import { onMounted, onUnmounted, readonly, ref } from "vue";

const online = ref(typeof navigator === "undefined" ? true : navigator.onLine);
const started = ref(false);

function start(): void {
  if (started.value || typeof window === "undefined") return;
  started.value = true;
  window.addEventListener("online", () => {
    online.value = true;
  });
  window.addEventListener("offline", () => {
    online.value = false;
  });
}

export function useOnline() {
  start();
  onMounted(start);
  onUnmounted(() => undefined);
  return { online: readonly(online), isOnline: online };
}

import { computed, ref } from "vue";

/** Global count of in-flight network requests (drives the top progress bar). */
export const pendingRequests = ref(0);

export function startRequest(): void {
  pendingRequests.value += 1;
}

export function endRequest(): void {
  pendingRequests.value = Math.max(0, pendingRequests.value - 1);
}

export const isLoading = computed(() => pendingRequests.value > 0);

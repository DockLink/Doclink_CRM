export type CrmDataKey = "leads" | "followups" | "dashboard" | "notifications";

const EVENT_NAME = "crm:data-changed";

export function notifyCrmDataChanged(...keys: CrmDataKey[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { keys } }));
}

export function onCrmDataChanged(
  keys: CrmDataKey[],
  listener: () => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const changedKeys = (event as CustomEvent<{ keys?: CrmDataKey[] }>).detail?.keys ?? [];
    if (keys.some((key) => changedKeys.includes(key))) listener();
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

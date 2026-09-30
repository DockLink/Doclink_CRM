"use client";

import { useCallback, useEffect, useRef } from "react";

const STORAGE_PREFIX = "doclink:draft:";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SENSITIVE_FIELD = /pass(word|wd|code)|pwd|secret|token|otp|cvv|cvc|iban|(credit|debit|bank).?card|card.?(number|no|holder|expiry)/i;

interface StoredDraft {
  savedAt: number;
  data: unknown;
}

let owner = "";
const clearListeners = new Map<string, Set<() => void>>();

function storageKey(key: string) {
  return owner && typeof window !== "undefined" ? `${STORAGE_PREFIX}${owner}:${key}` : null;
}

function ownerStorageKeys() {
  const prefix = `${STORAGE_PREFIX}${owner}:`;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

function removeStored(key: string) {
  const storage = storageKey(key);
  if (!storage) return;
  try {
    localStorage.removeItem(storage);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies); drafts are best-effort.
  }
}

function writeDraft(key: string, serializedData: string) {
  const storage = storageKey(key);
  if (!storage) return;
  try {
    localStorage.setItem(storage, `{"savedAt":${Date.now()},"data":${serializedData}}`);
  } catch {
    // Over quota: drop the older copy so a stale draft is never restored over newer input.
    removeStored(key);
  }
}

export function isSensitiveField(name: string) {
  return SENSITIVE_FIELD.test(name);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitiveField(key))
        .map(([key, entry]) => [key, sanitize(entry)]),
    );
  }
  return value;
}

/** Scopes drafts to the signed-in user so a shared browser never shows one user's input to another. */
export function setDraftOwner(userId: string) {
  owner = userId;
  if (typeof window === "undefined") return;
  try {
    for (const key of ownerStorageKeys()) {
      const entry = JSON.parse(localStorage.getItem(key) ?? "null") as StoredDraft | null;
      if (!entry || typeof entry.savedAt !== "number" || Date.now() - entry.savedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Pruning is opportunistic.
  }
}

/** Removes every draft for the current user. Also detaches the owner so forms unmounting during sign-out can't write drafts back. */
export function clearAllDrafts() {
  if (owner && typeof window !== "undefined") {
    try {
      for (const key of ownerStorageKeys()) localStorage.removeItem(key);
    } catch {
      // Nothing else to clean up.
    }
  }
  owner = "";
}

export function readDraft<T>(key: string | null): T | null {
  const storage = key ? storageKey(key) : null;
  if (!storage) return null;
  try {
    const entry = JSON.parse(localStorage.getItem(storage) ?? "null") as StoredDraft | null;
    if (!entry || entry.data === undefined || entry.data === null) return null;
    if (Date.now() - entry.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(storage);
      return null;
    }
    return entry.data as T;
  } catch {
    return null;
  }
}

/** Deletes a draft after its data was saved. Mounted forms using the key stop re-saving the value they currently hold. */
export function clearDraft(key: string) {
  removeStored(key);
  clearListeners.get(key)?.forEach((listener) => listener());
}

interface FormDraftOptions<T> {
  /** True when the value holds nothing worth restoring: blank, or identical to the saved record. */
  isEmpty: (value: T) => boolean;
  delay?: number;
}

/**
 * Persists `value` under `key` while the user edits, and on tab hide, page unload, or unmount.
 * Restore by seeding form state from `readDraft(key)`. Pass a `null` key to pause drafting.
 */
export function useFormDraft<T>(key: string | null, value: T, { isEmpty, delay = 400 }: FormDraftOptions<T>) {
  const latest = useRef({ key, value, dirty: false });
  const isEmptyRef = useRef(isEmpty);
  const cleared = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    isEmptyRef.current = isEmpty;
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const { key: activeKey, value: current, dirty } = latest.current;
    if (!activeKey || !dirty) return;
    latest.current.dirty = false;
    const serialized = JSON.stringify(sanitize(current));
    if (serialized === cleared.current) return;
    cleared.current = null;
    if (isEmptyRef.current(current)) removeStored(activeKey);
    else writeDraft(activeKey, serialized);
  }, []);

  useEffect(() => {
    if (!key) return;
    cleared.current = null;
    const markCleared = () => {
      clearTimeout(timer.current);
      latest.current.dirty = false;
      cleared.current = JSON.stringify(sanitize(latest.current.value));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const listeners = clearListeners.get(key) ?? new Set();
    listeners.add(markCleared);
    clearListeners.set(key, listeners);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      flush();
      listeners.delete(markCleared);
      if (listeners.size === 0) clearListeners.delete(key);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [key, flush]);

  useEffect(() => {
    const previous = latest.current;
    const sameKey = key !== null && previous.key === key;
    latest.current = { key, value, dirty: sameKey && (previous.dirty || !Object.is(previous.value, value)) };
    if (!latest.current.dirty) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [key, value, delay, flush]);

  return useCallback(() => {
    if (key) clearDraft(key);
  }, [key]);
}

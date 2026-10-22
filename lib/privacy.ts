"use client";

const KEY = "hisab-hide-amounts";
let value = false;
let inited = false;
const listeners = new Set<() => void>();

function load() {
  if (inited || typeof window === "undefined") return;
  inited = true;
  value = localStorage.getItem(KEY) === "1";
}

export function isAmountsHidden() {
  load();
  return value;
}

export function toggleAmountsHidden() {
  load();
  value = !value;
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {}
  listeners.forEach((cb) => cb());
}

export function subscribePrivacy(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getPrivacySnapshot() {
  return value;
}

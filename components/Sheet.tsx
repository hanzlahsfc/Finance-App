"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Sheet({
  title,
  onClose,
  children,
  right,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  right?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal>
        <div className="sheet-grabber" />
        {(title || right) && (
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose} className="text-sub text-[17px] flex items-center gap-1">
              <Icon name="x" size={20} />
            </button>
            <h2 className="text-[17px] font-semibold absolute left-1/2 -translate-x-1/2">{title}</h2>
            <div>{right}</div>
          </div>
        )}
        {children}
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";

export function Modal({ title, children, onClose, className = "" }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-head"><span>{title}</span><button autoFocus onClick={onClose} className="text-button" aria-label="閉じる">閉じる <span aria-hidden="true">×</span></button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}

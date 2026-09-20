"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function QrPreviewDialog({ open, src, onClose }: { open: boolean; src: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="qr-preview-dialog" aria-labelledby="qr-preview-title" onClose={onClose}>
      <div className="qr-preview-dialog-bar">
        <h2 id="qr-preview-title">Full-size QR preview</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close full-size preview"><X size={18} /></button>
      </div>
      <img src={src} width={768} height={768} alt="Full-size preview of your generated QR code" />
    </dialog>
  );
}

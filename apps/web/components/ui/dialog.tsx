"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

/**
 * Native <dialog> wrapper: showModal/close follow `open`, Escape and onClose
 * both route through `onClose`. Pass `dialogRef` to drive the element
 * directly (e.g. closing from a success effect without a setState-in-effect).
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  className,
  dialogRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  dialogRef?: Ref<HTMLDialogElement>;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDialogElement | null>(null);
  useImperativeHandle(dialogRef, () => innerRef.current!, []);

  useEffect(() => {
    const dialog = innerRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={innerRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      aria-labelledby={labelledBy}
      className={className}
    >
      {children}
    </dialog>
  );
}

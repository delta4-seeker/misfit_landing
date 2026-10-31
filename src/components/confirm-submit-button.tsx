"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  message: string;
  className?: string;
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
};

export function ConfirmSubmitButton({ children, message, className, disabled, formAction }: Props) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-confirm]")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") || []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  function confirm() {
    confirmedRef.current = true;
    setOpen(false);
    triggerRef.current?.click();
  }

  return (
    <>
      <button
        className={className}
        disabled={disabled || pending}
        formAction={formAction}
        onClick={(event) => {
          if (confirmedRef.current) {
            confirmedRef.current = false;
            return;
          }
          event.preventDefault();
          setOpen(true);
        }}
        ref={triggerRef}
        type="submit"
      >
        {pending ? <><span className="button-spinner" aria-hidden="true" />Working…</> : children}
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} ref={dialogRef}>
            <span className="confirmation-mark" aria-hidden="true">!</span>
            <h2 id={titleId}>Confirm this action.</h2>
            <p id={descriptionId}>{message}</p>
            <div className="confirmation-actions">
              <button className="btn btn-outline" onClick={() => setOpen(false)} type="button">Cancel</button>
              <button className="btn btn-dark" data-confirm onClick={confirm} type="button">{children}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

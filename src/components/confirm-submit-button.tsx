"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  message: string;
  className?: string;
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
};

export function ConfirmSubmitButton({ children, message, className, disabled, formAction }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={disabled || pending}
      formAction={formAction}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      type="submit"
    >
      {pending ? <><span className="button-spinner" aria-hidden="true" />Working…</> : children}
    </button>
  );
}

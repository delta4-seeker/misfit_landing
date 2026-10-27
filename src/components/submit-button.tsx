"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

export function SubmitButton({ children, pendingLabel = "Working…", className, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return <button {...props} className={className} type="submit" disabled={disabled || pending} aria-busy={pending}>
    {pending ? <><span className="button-spinner" aria-hidden="true" />{pendingLabel}</> : children}
  </button>;
}

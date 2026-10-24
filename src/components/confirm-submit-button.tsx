"use client";

type Props = {
  children: React.ReactNode;
  message: string;
  className?: string;
  disabled?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
};

export function ConfirmSubmitButton({ children, message, className, disabled, formAction }: Props) {
  return (
    <button
      className={className}
      disabled={disabled}
      formAction={formAction}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      type="submit"
    >
      {children}
    </button>
  );
}

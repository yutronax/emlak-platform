import type { InputHTMLAttributes } from "react";

export const inputClass =
  "rounded-md border border-mist-200 bg-white px-3 py-2.5 text-ink-900 aria-[invalid=true]:border-brick-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta-600";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-brick-700">
      {message}
    </p>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({ name, label, error, hint, className, ...rest }: TextFieldProps) {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        {...rest}
        id={name}
        name={name}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy || undefined}
        className={[inputClass, className].filter(Boolean).join(" ")}
      />
      {hint && (
        <p id={`${name}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-mist-200 bg-white px-4 py-2.5 font-medium text-ink-900 hover:bg-mist-200/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 disabled:opacity-50"
      >
        <span aria-hidden="true" className="font-display font-bold text-terracotta-600">
          G
        </span>
        Google ile devam et
      </button>
      <div className="flex items-center gap-3 text-xs text-slate-500" aria-hidden="true">
        <span className="h-px flex-1 bg-mist-200" />
        veya
        <span className="h-px flex-1 bg-mist-200" />
      </div>
    </>
  );
}

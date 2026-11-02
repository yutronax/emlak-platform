import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  isPending?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
};

// Tasarım dili: birincil lacivert, imza köşe (rounded-leaf); turuncu yalnız küçük vurgularda.
const base =
  "inline-flex items-center justify-center gap-2 rounded-leaf px-4 py-2 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink-900 text-white hover:bg-ink-800",
  secondary: "border border-ink-900 text-ink-900 bg-transparent hover:bg-ink-900/5",
};

export function Button({
  variant = "primary",
  isPending = false,
  disabled,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || isPending}
      aria-busy={isPending ? "true" : undefined}
      className={[base, variants[variant], className].filter(Boolean).join(" ")}
    >
      {isPending && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

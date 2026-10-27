import type { ReactNode } from "react";

type AlertVariant = "error" | "success";

type AlertProps = {
  variant: AlertVariant;
  children: ReactNode;
};

const variants: Record<AlertVariant, { role: "alert" | "status"; className: string }> = {
  error: {
    role: "alert",
    className: "border-brick-700 bg-brick-700/10 text-brick-700",
  },
  success: {
    role: "status",
    className: "border-moss-700 bg-moss-700/10 text-moss-700",
  },
};

export function Alert({ variant, children }: AlertProps) {
  const { role, className } = variants[variant];
  return (
    <div role={role} className={`rounded-md border px-4 py-3 text-sm ${className}`}>
      {children}
    </div>
  );
}

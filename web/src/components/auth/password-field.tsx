"use client";

import { useState } from "react";

import { checkPassword, LEVEL_LABEL } from "@/lib/auth-ui/password-strength";

import { FieldError, inputClass } from "./field";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  error?: string;
  showStrength?: boolean;
};

const barColor = { weak: "bg-brick-700", medium: "bg-terracotta-600", strong: "bg-moss-700" } as const;
const barCount = { weak: 1, medium: 2, strong: 3 } as const;

export function PasswordField({ value, onChange, autoComplete, error, showStrength = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = checkPassword(value);
  const describedBy = [error && "password-error", showStrength && "password-strength"].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="password" className="text-sm font-medium">
        Şifre
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          className={`${inputClass} w-full pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          className="absolute inset-y-1 right-1 rounded px-3 text-sm font-medium text-slate-500 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-terracotta-600"
        >
          {visible ? "Gizle" : "Göster"}
        </button>
      </div>
      <FieldError id="password-error" message={error} />
      {showStrength && (
        <div id="password-strength" className="mt-1">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  value && i < barCount[strength.level] ? barColor[strength.level] : "bg-mist-200"
                }`}
              />
            ))}
          </div>
          {value && (
            <p className="mt-1 text-xs font-medium" aria-live="polite">
              Şifre gücü: {LEVEL_LABEL[strength.level]}
            </p>
          )}
          <ul className="mt-1 grid grid-cols-1 gap-x-3 text-xs text-slate-500 sm:grid-cols-2">
            {strength.rules.map((rule) => (
              <li key={rule.label} className={rule.ok ? "text-moss-700" : undefined}>
                <span aria-hidden="true">{rule.ok ? "✓" : "○"}</span> {rule.label}
                <span className="sr-only">{rule.ok ? " (sağlandı)" : " (eksik)"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

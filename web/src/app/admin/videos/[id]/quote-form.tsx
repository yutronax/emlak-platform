"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { setQuote } from "../actions";

const GENERIC_ERROR = "Bir hata oluştu, lütfen tekrar deneyin.";

export function QuoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const inputId = useId();
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await setQuote(orderId, price);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="font-medium">
          Fiyat (TL)
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Örn. 1500"
          className="min-h-12 w-full rounded-md border border-mist-200 bg-white px-4 text-base"
        />
        <p className="text-sm text-slate-500">Örnek: 1500 veya 1.500,50</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Button type="submit" isPending={pending} className="min-h-12 self-start">
        Fiyatı gönder
      </Button>
    </form>
  );
}

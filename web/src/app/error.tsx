"use client";

import { ErrorScreen } from "@/components/status/error-screen";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}

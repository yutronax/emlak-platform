import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";

export function WhatsAppButton() {
  return (
    <a
      href={SUPPORT_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp'tan destek alın"
      className="fixed bottom-4 right-4 z-50 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-ink-900 text-white shadow-lg transition-colors hover:bg-ink-900/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 md:h-auto md:w-auto md:flex-row md:gap-2 md:rounded-full md:px-4 md:py-3"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M4 5h16v11H9l-5 4V5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden font-body text-sm font-medium md:inline">Destek</span>
    </a>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX Desk — Forex signals and order blocks",
  description:
    "Live forex prices with composite signal strength and automatically "
    + "detected order blocks. A demonstration project, not trading advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-lg font-semibold tracking-tight">
                FX<span className="text-accent">.</span>Desk
              </span>
              <span className="hidden text-xs text-faint sm:inline">
                Signals &amp; order blocks
              </span>
            </div>
            <p className="rounded border border-line px-2.5 py-1 font-mono text-[10px] text-faint">
              Demo · not trading advice
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>

        <footer className="mt-8 border-t border-line">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-6 text-[11px] leading-relaxed text-faint">
            <p>
              <strong className="text-muted">Not financial advice.</strong>{" "}
              Everything here is computed from public end-of-day exchange rates
              for demonstration purposes. Signal scores are arithmetic on past
              prices — they do not predict anything, and order blocks are a
              charting convention, not a fact about the market. Do not trade
              from this.
            </p>
            <p>
              Prices from{" "}
              <a
                href="https://docs.awesomeapi.com.br/api-de-moedas"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline underline-offset-2 hover:text-accent"
              >
                AwesomeAPI
              </a>
              , daily candles, refreshed every 20 seconds. Built with Next.js.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

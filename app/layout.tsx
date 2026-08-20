import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX Desk — Live charts and signal strength",
  description:
    "Live TradingView charts for forex, gold and crypto, with a composite "
    + "signal-strength score. A demonstration project, not trading advice.",
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
                Live charts &amp; signals
              </span>
            </div>
            <p className="rounded border border-line px-2.5 py-1 font-mono text-[10px] text-faint">
              Demo · not trading advice
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>

        <footer className="mt-8 border-t border-line">
          <div className="mx-auto max-w-[1600px] space-y-2 px-4 py-6 text-[11px] leading-relaxed text-faint">
            <p>
              <strong className="text-muted">Not financial advice.</strong>{" "}
              Signal scores are arithmetic on past prices and predict nothing.
              This is a demonstration of data fetching and algorithm design, not
              a trading system. Do not trade from it.
            </p>
            <p>
              Charts and chart prices by{" "}
              <a
                href="https://www.tradingview.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline underline-offset-2 hover:text-accent"
              >
                TradingView
              </a>
              . Signal analysis computed from Twelve Data, Binance and ECB
              reference rates. Built with Next.js.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

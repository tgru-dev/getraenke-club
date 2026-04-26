export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl">📵</div>
      <h1 className="text-2xl font-bold">Offline</h1>
      <p className="text-sm text-neutral-400">
        Keine Verbindung. Sobald das WLAN wieder da ist, werden offene
        Buchungen automatisch nachgereicht.
      </p>
    </main>
  );
}

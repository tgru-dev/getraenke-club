import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Tally } from "../components/Tally";
import type { WrappedData } from "../../shared/types";

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
  });
}

export function Wrapped() {
  const { member } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<WrappedData | null>(null);

  useEffect(() => {
    setData(null);
    api<WrappedData>(`/me/wrapped?year=${year}`).then(setData).catch(() => {});
  }, [year]);

  const firstName = member?.name.split(" ")[0] ?? "";
  const top = data?.perCategory[0];

  // Karten nacheinander einblenden
  let cardIndex = 0;
  const card = (content: React.ReactNode, accent?: string) => (
    <div
      key={cardIndex}
      className="animate-rise rounded-3xl border border-line bg-surface p-6 text-center"
      style={{ animationDelay: `${cardIndex++ * 180}ms`, borderColor: accent ? `${accent}59` : undefined }}
    >
      {content}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link to="/profil" className="text-muted">← zurück</Link>
        <div className="flex gap-2">
          {[currentYear, currentYear - 1].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-xl border px-3 py-1.5 text-sm font-medium ${
                year === y ? "border-amber/60 bg-amber/15 text-amber" : "border-line text-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </header>

      <h1 className="text-center font-display text-4xl font-extrabold tracking-tight animate-pop">
        🎉 Dein {year}
        <span className="block text-lg font-bold text-muted">im Club, {firstName}</span>
      </h1>

      {!data && <p className="text-center text-muted">Zähle Striche …</p>}

      {data && data.myTotal === 0 && (
        <div className="animate-pop rounded-3xl border border-line bg-surface p-8 text-center">
          <p className="text-5xl">🌵</p>
          <p className="mt-3 font-display text-xl font-bold">Kein einziger Strich in {year}</p>
          <p className="mt-1 text-muted">
            Entweder warst du sehr diszipliniert – oder sehr selten da. 😄
          </p>
        </div>
      )}

      {data && data.myTotal > 0 && (
        <>
          {card(
            <>
              <p className="text-sm uppercase tracking-wider text-muted">Deine Striche</p>
              <p className="font-display text-6xl font-extrabold text-amber">{data.myTotal}</p>
              <div className="mt-2 flex justify-center">
                <Tally count={Math.min(data.myTotal, 25)} />
              </div>
              {data.myTotal > 25 && <p className="mt-1 text-xs text-muted">… und so weiter 😅</p>}
            </>
          )}

          {top &&
            card(
              <>
                <p className="text-sm uppercase tracking-wider text-muted">Dein Getränk des Jahres</p>
                <p className="mt-1 font-display text-3xl font-extrabold" style={{ color: top.color }}>
                  {top.name}
                </p>
                <p className="mt-1 text-muted">{top.count}× gebucht</p>
              </>,
              top.color
            )}

          {card(
            <>
              <p className="text-sm uppercase tracking-wider text-muted">Du warst da an</p>
              <p className="font-display text-5xl font-extrabold text-amber">{data.activeDays}</p>
              <p className="text-muted">Tagen{data.activeDays >= 52 ? " – quasi Stammplatz 🪑" : ""}</p>
            </>
          )}

          {data.busiestDay &&
            card(
              <>
                <p className="text-sm uppercase tracking-wider text-muted">Dein größter Abend</p>
                <p className="mt-1 font-display text-2xl font-extrabold">
                  {formatDate(data.busiestDay.date)}
                </p>
                <p className="text-muted">{data.busiestDay.count} Striche an einem Tag 💪</p>
              </>
            )}

          {data.busiestWeekday !== null &&
            card(
              <>
                <p className="text-sm uppercase tracking-wider text-muted">Dein Tag</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-amber">
                  {WEEKDAYS[data.busiestWeekday]}
                </p>
                <p className="text-muted">läuft bei dir am besten</p>
              </>
            )}

          {data.nightOwl &&
            card(
              <>
                <p className="text-sm uppercase tracking-wider text-muted">Nachteulen-Moment 🦉</p>
                <p className="mt-1 font-display text-3xl font-extrabold">{data.nightOwl.time} Uhr</p>
                <p className="text-muted">am {formatDate(data.nightOwl.date)} – Respekt.</p>
              </>
            )}

          {card(
            <>
              <p className="text-sm uppercase tracking-wider text-muted">Der ganze Club in {year}</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-amber">{data.clubTotal}</p>
              <p className="text-muted">
                Striche zusammen
                {data.clubTopCategory && (
                  <span className="block">Publikumsliebling: {data.clubTopCategory}</span>
                )}
              </p>
            </>
          )}

          <p
            className="animate-rise pb-4 text-center font-display text-xl font-bold"
            style={{ animationDelay: `${cardIndex * 180}ms` }}
          >
            Prost auf {year + 1}! 🍻
          </p>
        </>
      )}
    </div>
  );
}

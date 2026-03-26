"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import type { SlotStatus } from "@prisma/client";
import { buildTimeSlots } from "@/lib/time";
import { saveAvailability } from "@/app/actions";

type ParticipantSeed = {
  id: string;
  name: string;
  userId: string | null;
  slots: { date: string; time: string; status: SlotStatus }[];
};

type EventBoardProps = {
  slug: string;
  eventId: string;
  dates: string[];
  startTime: string;
  endTime: string;
  slotDuration: number;
  deadline?: string | null;
  signedInUserId?: string;
  signedInUserName?: string;
  participants: ParticipantSeed[];
};

type FillMode = "AVAILABLE" | "IF_NEEDED";

function getSlotKeysInRange(
  date1: string,
  time1: string,
  date2: string,
  time2: string,
  visibleDates: string[],
  slots: string[],
): string[] {
  const d1 = visibleDates.indexOf(date1);
  const d2 = visibleDates.indexOf(date2);
  const t1 = slots.indexOf(time1);
  const t2 = slots.indexOf(time2);
  const minD = Math.min(d1, d2);
  const maxD = Math.max(d1, d2);
  const minT = Math.min(t1, t2);
  const maxT = Math.max(t1, t2);
  const keys: string[] = [];
  for (let d = minD; d <= maxD; d++) {
    for (let t = minT; t <= maxT; t++) {
      keys.push(`${visibleDates[d]}|${slots[t]}`);
    }
  }
  return keys;
}

export function EventBoard({
  slug,
  dates,
  startTime,
  endTime,
  slotDuration,
  deadline,
  signedInUserId,
  signedInUserName,
  participants,
}: EventBoardProps) {
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [fillMode, setFillMode] = useState<FillMode>("AVAILABLE");
  const [includeIfNeeded, setIncludeIfNeeded] = useState(true);
  const [selected, setSelected] = useState<Record<string, SlotStatus>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [paintedSlots, setPaintedSlots] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const isDraggingRef = useRef(false);
  const paintedSlotsRef = useRef<Set<string>>(new Set());
  const lastPaintedRef = useRef<{ date: string; time: string } | null>(null);
  const fillModeRef = useRef<FillMode>(fillMode);
  const busyRef = useRef(busy);

  useEffect(() => {
    fillModeRef.current = fillMode;
  }, [fillMode]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const readOnly = Boolean(deadline && new Date() > new Date(deadline));
  const slots = useMemo(
    () => buildTimeSlots(startTime, endTime, slotDuration),
    [startTime, endTime, slotDuration],
  );
  const pages = Math.ceil(dates.length / 7);
  const visibleDates = dates.slice(page * 7, page * 7 + 7);

  useEffect(() => {
    const key = `participant_${slug}`;
    const stored = localStorage.getItem(key);
    const byAccount = signedInUserId
      ? participants.find((p) => p.userId === signedInUserId)
      : undefined;
    const byStored = stored ? participants.find((p) => p.id === stored) : undefined;
    const picked = byAccount ?? byStored;
    if (!picked) return;
    setParticipantId(picked.id);
    setName(picked.name);
    setSaved(true);
    setSelected(
      Object.fromEntries(
        picked.slots.map((slot) => [`${slot.date}|${slot.time}`, slot.status]),
      ),
    );
  }, [participants, signedInUserId, slug]);

  useEffect(() => {
    if (!signedInUserName) return;
    setName((prev) => prev || signedInUserName);
  }, [signedInUserName]);

  useEffect(() => {
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const toPaint = new Set(paintedSlotsRef.current);
      paintedSlotsRef.current = new Set();
      lastPaintedRef.current = null;

      if (toPaint.size === 0) {
        setPaintedSlots(new Set());
        return;
      }

      setSelected((prev) => {
        const next = { ...prev };
        for (const key of toPaint) {
          if (!busyRef.current[key]) {
            next[key] = fillModeRef.current;
          }
        }
        return next;
      });

      setPaintedSlots(new Set());
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  const peopleByCell = useMemo(() => {
    const map: Record<string, { name: string; status: SlotStatus }[]> = {};
    for (const participant of participants) {
      for (const slot of participant.slots) {
        const key = `${slot.date}|${slot.time}`;
        map[key] ??= [];
        map[key].push({ name: participant.name, status: slot.status });
      }
    }
    if (name) {
      for (const [key, status] of Object.entries(selected)) {
        map[key] = [
          ...(map[key] ?? []).filter((r) => r.name !== name),
          { name, status },
        ];
      }
    }
    return map;
  }, [participants, selected, name]);

  function getHeatmapColor(key: string): string {
    const list = peopleByCell[key] ?? [];
    const count = list.filter((e) =>
      includeIfNeeded ? true : e.status === "AVAILABLE",
    ).length;
    if (count === 0) return "bg-card hover:bg-muted";
    if (count === 1) return "bg-green-200 hover:bg-green-300";
    if (count === 2) return "bg-green-300 hover:bg-green-400";
    if (count === 3) return "bg-green-400 hover:bg-green-500";
    return "bg-green-500 hover:bg-green-600";
  }

  function handleCellMouseDown(date: string, time: string) {
    if (readOnly) return;
    const key = `${date}|${time}`;
    if (busyRef.current[key]) return;
    isDraggingRef.current = true;
    paintedSlotsRef.current = new Set([key]);
    setPaintedSlots(new Set([key]));
    lastPaintedRef.current = { date, time };
  }

  function handleCellMouseEnter(date: string, time: string) {
    if (!isDraggingRef.current) return;
    const last = lastPaintedRef.current;
    const keys = last
      ? getSlotKeysInRange(last.date, last.time, date, time, visibleDates, slots)
      : [`${date}|${time}`];
    const nextPainted = new Set(paintedSlotsRef.current);
    for (const k of keys) nextPainted.add(k);
    paintedSlotsRef.current = nextPainted;
    setPaintedSlots((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
    lastPaintedRef.current = { date, time };
  }

  async function submitAvailability() {
    if (!name.trim()) {
      alert("Vennligst skriv inn navnet ditt.");
      return;
    }
    const payload = Object.entries(selected)
      .filter(([key]) => !busy[key])
      .map(([key, status]) => {
        const [date, time] = key.split("|");
        return { date, time, status };
      });
    const res = await saveAvailability({
      eventSlug: slug,
      participantId,
      participantName: name.trim(),
      slots: payload,
    });
    localStorage.setItem(`participant_${slug}`, res.participantId);
    setParticipantId(res.participantId);
    setSaved(true);
  }

  async function syncGoogleCalendar() {
    const res = await fetch("/api/sync-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      alert("Synkronisering feilet.");
      return;
    }
    const data = (await res.json()) as { blocked: string[] };
    const blockedMap = Object.fromEntries(data.blocked.map((k) => [k, true]));
    setBusy(blockedMap);
    setSelected((prev) => {
      const next = { ...prev };
      for (const key of data.blocked) delete next[key];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        {/* Controls */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navnet ditt"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
            disabled={readOnly}
          />
          {signedInUserId ? (
            <button
              onClick={syncGoogleCalendar}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Synkroniser Google Kalender
            </button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {saved ? "Lagret. Du kan fortsette å redigere." : "Ikke lagret ennå."}
          </p>
          <button
            onClick={submitAvailability}
            disabled={readOnly}
            className="ml-auto rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Lagre tilgjengelighet
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Fyllmodus:</span>
            <button
              onClick={() => setFillMode("AVAILABLE")}
              className={`rounded px-2 py-1 text-xs font-medium ${fillMode === "AVAILABLE" ? "bg-green-700 text-white" : "bg-muted text-muted-foreground hover:opacity-90"}`}
            >
              Tilgjengelig
            </button>
            <button
              onClick={() => setFillMode("IF_NEEDED")}
              className={`rounded px-2 py-1 text-xs font-medium ${fillMode === "IF_NEEDED" ? "bg-green-300 text-card-foreground" : "bg-muted text-muted-foreground hover:opacity-90"}`}
            >
              Om nødvendig
            </button>
          </div>
          <label className="flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={includeIfNeeded}
              onChange={(e) => setIncludeIfNeeded(e.target.checked)}
            />
            Inkluder "om nødvendig"
          </label>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="mb-3 flex items-center justify-between">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded border border-border px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"
            >
              ← Forrige
            </button>
            <p className="text-xs text-muted-foreground">
              Dager {page * 7 + 1}–{Math.min(page * 7 + 7, dates.length)} av{" "}
              {dates.length}
            </p>
            <button
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="rounded border border-border px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"
            >
              Neste →
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="overflow-x-auto">
          <div
            className="grid min-w-full select-none gap-0 text-sm"
            style={{
              gridTemplateColumns: `56px repeat(${visibleDates.length}, minmax(80px, 1fr))`,
              gridTemplateRows: `40px repeat(${slots.length}, 32px)`,
            }}
          >
            {/* Header */}
            <div className="border border-border bg-muted p-1 text-xs font-medium text-muted-foreground">
              Tid
            </div>
            {visibleDates.map((date) => {
              const d = parseISO(date);
              return (
                <div
                  key={date}
                  className="flex flex-col items-center justify-center border border-border bg-muted p-1 text-center"
                >
                  <span className="text-xs font-medium text-card-foreground">
                    {format(d, "d. MMM", { locale: nb })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(d, "EEE", { locale: nb })}
                  </span>
                </div>
              );
            })}

            {/* Time rows */}
            {slots.map((time) => {
              const [hourStr, minStr] = time.split(":");
              const isHour = minStr === "00";
              return (
                <Fragment key={time}>
                  <div className="flex items-start border-b border-r border-border bg-muted px-1.5 py-0.5 text-xs leading-none text-muted-foreground">
                    {isHour ? hourStr : ""}
                  </div>
                  {visibleDates.map((date, dateIndex) => {
                    const key = `${date}|${time}`;
                    const mine = selected[key];
                    const isPainted = paintedSlots.has(key);
                    const isBusy = busy[key];

                    let colorClass = getHeatmapColor(key);
                    if (isBusy) {
                      colorClass = "bg-border cursor-not-allowed";
                    } else if (isPainted) {
                      colorClass =
                        fillMode === "AVAILABLE" ? "bg-green-600" : "bg-green-300";
                    } else if (mine === "AVAILABLE") {
                      colorClass = "bg-green-600 hover:bg-green-700";
                    } else if (mine === "IF_NEEDED") {
                      colorClass = "bg-green-300 hover:bg-green-400";
                    }

                    const people = peopleByCell[key] ?? [];
                    const tooltip = people.length
                      ? people
                          .map(
                            (p) =>
                              `${p.name}: ${p.status === "AVAILABLE" ? "Tilgjengelig" : "Om nødvendig"}`,
                          )
                          .join("\n")
                      : "Ingen ennå";

                    return (
                      <button
                        key={key}
                        type="button"
                        title={tooltip}
                        onMouseDown={() => handleCellMouseDown(date, time)}
                        onMouseEnter={() => handleCellMouseEnter(date, time)}
                        disabled={readOnly}
                        className={`relative block h-full w-full min-w-0 border-b border-r border-border p-0 leading-none transition-colors ${colorClass} ${!readOnly && !isBusy ? "cursor-pointer" : "cursor-default"} ${dateIndex === 0 ? "border-l" : ""}`}
                      >
                        {mine === "IF_NEEDED" && !isPainted ? (
                          <span
                            className="pointer-events-none absolute inset-0 opacity-40"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(135deg, rgba(5,150,105,0.5), rgba(5,150,105,0.5) 4px, transparent 4px, transparent 8px)",
                            }}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

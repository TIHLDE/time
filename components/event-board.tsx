"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format, parseISO } from "date-fns";
import { nb } from "date-fns/locale";
import Link from "next/link";
import type { SlotStatus } from "@prisma/client";
import {
  getEventTimezone,
  slotIndicesOverlappingEventOnDate,
} from "@/lib/event-timezone";
import type { SyncCalendarEvent } from "@/lib/types";
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
  shareUrl: string;
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

type CellVisual = "empty" | "green" | "yellow" | "red";

type DragAction = "add_available" | "remove" | "add_if_needed";

function getSlotKeysInRange(
  date1: string,
  time1: string,
  date2: string,
  time2: string,
  visibleDates: string[],
  slotTimes: string[],
): string[] {
  const d1 = visibleDates.indexOf(date1);
  const d2 = visibleDates.indexOf(date2);
  const t1 = slotTimes.indexOf(time1);
  const t2 = slotTimes.indexOf(time2);
  const minD = Math.min(d1, d2);
  const maxD = Math.max(d1, d2);
  const minT = Math.min(t1, t2);
  const maxT = Math.max(t1, t2);
  const keys: string[] = [];
  for (let d = minD; d <= maxD; d++) {
    for (let t = minT; t <= maxT; t++) {
      keys.push(`${visibleDates[d]}|${slotTimes[t]}`);
    }
  }
  return keys;
}

function getCellVisual(
  key: string,
  selected: Record<string, SlotStatus>,
  isEditing: boolean,
): CellVisual {
  const s = selected[key];
  if (s === "AVAILABLE") return "green";
  if (s === "IF_NEEDED") return "yellow";
  if (isEditing) return "red";
  return "empty";
}

function resolveDragAction(
  mode: FillMode,
  visual: CellVisual,
): DragAction | null {
  if (visual === "empty") return null;
  if (mode === "AVAILABLE") {
    return visual === "green" ? "remove" : "add_available";
  }
  return visual === "yellow" ? "remove" : "add_if_needed";
}

function areSelectionsEqual(
  a: Record<string, SlotStatus>,
  b: Record<string, SlotStatus>,
): boolean {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);
  if (aEntries.length !== bEntries.length) return false;

  for (const [key, value] of aEntries) {
    if (b[key] !== value) return false;
  }
  return true;
}

export function EventBoard({
  slug,
  shareUrl,
  dates,
  startTime,
  endTime,
  slotDuration,
  deadline,
  signedInUserId,
  signedInUserName,
  participants,
}: EventBoardProps) {
  const [participantId, setParticipantId] = useState<string | undefined>();
  const [loadedParticipantName, setLoadedParticipantName] = useState<
    string | undefined
  >();
  const [saved, setSaved] = useState(false);
  const [fillMode, setFillMode] = useState<FillMode>("AVAILABLE");
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<Record<string, SlotStatus>>({});
  const [persistedSelected, setPersistedSelected] = useState<
    Record<string, SlotStatus>
  >({});
  const [calendarUnavailable, setCalendarUnavailable] = useState<
    Record<string, boolean>
  >({});
  const [calendarEvents, setCalendarEvents] = useState<SyncCalendarEvent[]>(
    [],
  );
  const [paintedSlots, setPaintedSlots] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fillingWave, setFillingWave] = useState(false);
  /** Increment to restart the primary-button nudge animation. */
  const [primaryBlinkNonce, setPrimaryBlinkNonce] = useState(0);
  const [hoveredParticipantId, setHoveredParticipantId] = useState<
    string | null
  >(null);
  const [narrowGrid, setNarrowGrid] = useState(false);

  const displayName =
    signedInUserName?.trim() || loadedParticipantName?.trim() || "";

  const isDraggingRef = useRef(false);
  const paintedSlotsRef = useRef<Set<string>>(new Set());
  const lastPaintedRef = useRef<{ date: string; time: string } | null>(null);
  const dragActionRef = useRef<DragAction | null>(null);
  const fillModeRef = useRef<FillMode>(fillMode);
  const isEditingRef = useRef(isEditing);
  const selectedRef = useRef(selected);
  useEffect(() => {
    fillModeRef.current = fillMode;
  }, [fillMode]);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const readOnly = Boolean(deadline && new Date() > new Date(deadline));
  const canParticipate = Boolean(signedInUserId && signedInUserName?.trim());
  const othersHaveSlots = participants.some((p) => p.slots.length > 0);
  const showHeatmap =
    saved || (!canParticipate && othersHaveSlots);
  const hasUnsavedChanges = !areSelectionsEqual(selected, persistedSelected);
  const slots = useMemo(
    () => buildTimeSlots(startTime, endTime, slotDuration),
    [startTime, endTime, slotDuration],
  );
  const pages = Math.ceil(dates.length / 7);
  const visibleDates = dates.slice(page * 7, page * 7 + 7);

  const calendarOverlayPlacements = useMemo(() => {
    if (calendarEvents.length === 0) return [];
    const tz = getEventTimezone();
    type Placement = {
      key: string;
      dateCol: number;
      rowStart: number;
      rowEnd: number;
      title: string;
    };
    const raw: Placement[] = [];
    for (const ev of calendarEvents) {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      if (Number.isNaN(evStart.getTime()) || Number.isNaN(evEnd.getTime())) {
        continue;
      }
      for (let d = 0; d < visibleDates.length; d++) {
        const dateStr = visibleDates[d];
        const idx = slotIndicesOverlappingEventOnDate(
          dateStr,
          evStart,
          evEnd,
          slots,
          slotDuration,
          tz,
        );
        if (!idx) continue;
        raw.push({
          key: `${ev.start}|${ev.end}|${dateStr}|${d}`,
          dateCol: d,
          rowStart: idx.startIdx + 2,
          rowEnd: idx.endIdxExclusive + 2,
          title: ev.title,
        });
      }
    }

    const byCol = new Map<number, Placement[]>();
    for (const p of raw) {
      const list = byCol.get(p.dateCol) ?? [];
      list.push(p);
      byCol.set(p.dateCol, list);
    }

    const result: (Placement & { layer: number; zIndex: number })[] = [];
    for (const [, list] of byCol) {
      const sorted = [...list].sort((a, b) => a.rowStart - b.rowStart);
      const layers: number[] = [];
      for (let i = 0; i < sorted.length; i++) {
        let layer = 0;
        for (let j = 0; j < i; j++) {
          const overlaps =
            sorted[i].rowStart < sorted[j].rowEnd &&
            sorted[j].rowStart < sorted[i].rowEnd;
          if (overlaps) {
            layer = Math.max(layer, layers[j] + 1);
          }
        }
        layers[i] = layer;
        result.push({
          ...sorted[i],
          layer,
          zIndex: 10 + layer,
        });
      }
    }
    return result;
  }, [calendarEvents, visibleDates, slots, slotDuration]);

  useEffect(() => {
    const key = `participant_${slug}`;
    const stored = localStorage.getItem(key);
    const byAccount = signedInUserId
      ? participants.find((p) => p.userId === signedInUserId)
      : undefined;
    const byStored = stored
      ? participants.find((p) => p.id === stored)
      : undefined;
    const picked = byAccount ?? byStored;
    if (!picked) return;
    setParticipantId(picked.id);
    setLoadedParticipantName(picked.name);
    setSaved(true);
    setIsEditing(false);
    const pickedSelected = Object.fromEntries(
      picked.slots.map((slot) => [`${slot.date}|${slot.time}`, slot.status]),
    );
    setSelected(pickedSelected);
    setPersistedSelected(pickedSelected);
  }, [participants, signedInUserId, slug]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrowGrid(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const commitPaintDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const action = dragActionRef.current;
    dragActionRef.current = null;
    const toPaint = new Set(paintedSlotsRef.current);
    paintedSlotsRef.current = new Set();
    lastPaintedRef.current = null;

    if (!action || toPaint.size === 0) {
      setPaintedSlots(new Set());
      return;
    }

    setSelected((prev) => {
      const next = { ...prev };
      for (const key of toPaint) {
        if (action === "remove") {
          delete next[key];
        } else if (action === "add_available") {
          next[key] = "AVAILABLE";
        } else {
          next[key] = "IF_NEEDED";
        }
      }
      return next;
    });

    setPaintedSlots(new Set());
  }, []);

  useEffect(() => {
    const onPointerEnd = () => {
      commitPaintDrag();
    };
    document.addEventListener("pointerup", onPointerEnd);
    document.addEventListener("pointercancel", onPointerEnd);
    return () => {
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [commitPaintDrag]);

  const peopleByCell = useMemo(() => {
    const map: Record<string, { name: string; status: SlotStatus }[]> = {};
    for (const participant of participants) {
      for (const slot of participant.slots) {
        const key = `${slot.date}|${slot.time}`;
        map[key] ??= [];
        map[key].push({ name: participant.name, status: slot.status });
      }
    }
    if (displayName) {
      for (const [key, status] of Object.entries(selected)) {
        map[key] = [
          ...(map[key] ?? []).filter((r) => r.name !== displayName),
          { name: displayName, status },
        ];
      }
    }
    return map;
  }, [participants, selected, displayName]);

  const participantsWithAvailability = useMemo(
    () =>
      [...participants]
        .filter((p) => p.slots.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, "nb")),
    [participants],
  );

  const hoveredSlots = useMemo(() => {
    if (!hoveredParticipantId) return null;
    const p = participants.find((x) => x.id === hoveredParticipantId);
    if (!p) return null;
    const map: Record<string, SlotStatus> = Object.fromEntries(
      p.slots.map((slot) => [`${slot.date}|${slot.time}`, slot.status]),
    );
    if (participantId && hoveredParticipantId === participantId) {
      for (const [key, status] of Object.entries(selected)) {
        map[key] = status;
      }
    }
    return map;
  }, [hoveredParticipantId, participants, participantId, selected]);

  const heatmapMaxCount = useMemo(() => {
    let max = 0;
    for (const date of visibleDates) {
      for (const time of slots) {
        const key = `${date}|${time}`;
        const list = peopleByCell[key] ?? [];
        const availableCount = list.filter((e) => e.status === "AVAILABLE").length;
        const ifNeededCount = list.filter((e) => e.status === "IF_NEEDED").length;
        const totalCount = availableCount + ifNeededCount;
        max = Math.max(max, totalCount);
      }
    }
    return max;
  }, [visibleDates, slots, peopleByCell]);

  function getHeatmapColor(key: string): string {
    const list = peopleByCell[key] ?? [];
    const availableCount = list.filter((e) => e.status === "AVAILABLE").length;
    const ifNeededCount = list.filter((e) => e.status === "IF_NEEDED").length;

    const green = (count: number) => {
      if (count === 1) return "bg-green-300 hover:bg-green-400";
      if (count === 2) return "bg-green-400 hover:bg-green-500";
      if (count === 3) return "bg-green-500 hover:bg-green-600";
      return "bg-green-600 hover:bg-green-700";
    };
    const yellow = (count: number) => {
      if (count === 1) return "bg-yellow-200 hover:bg-yellow-300";
      if (count === 2) return "bg-yellow-300 hover:bg-yellow-400";
      if (count === 3) return "bg-yellow-400 hover:bg-yellow-500";
      return "bg-yellow-500 hover:bg-yellow-600";
    };

    const totalCount = availableCount + ifNeededCount;
    if (totalCount === 0) return "bg-muted/80 hover:bg-muted";

    if (heatmapMaxCount > 0 && totalCount === heatmapMaxCount) {
      return green(totalCount);
    }

    if (availableCount === 0 && ifNeededCount > 0) return yellow(ifNeededCount);
    if (ifNeededCount === 0 && availableCount > 0) return green(availableCount);

    const dominantIfNeeded = ifNeededCount > availableCount;
    const dominantCount = Math.max(availableCount, ifNeededCount);
    return dominantIfNeeded ? yellow(dominantCount) : green(dominantCount);
  }

  function previewClassForPaint(): string {
    const action = dragActionRef.current;
    if (!action) return "bg-muted";
    if (action === "remove") return "bg-red-300";
    if (action === "add_available") return "bg-green-300";
    return "bg-yellow-400";
  }

  function cellBackgroundClass(args: {
    key: string;
    mine: SlotStatus | undefined;
    isPainted: boolean;
    isCalendarUnavailable: boolean;
    hoverActive: boolean;
    hoveredStatus: SlotStatus | undefined;
  }): string {
    const {
      key,
      mine,
      isPainted,
      isCalendarUnavailable,
      hoverActive,
      hoveredStatus,
    } = args;
    if (isPainted) return `${previewClassForPaint()} cursor-pointer`;

    if (hoverActive) {
      if (hoveredStatus === "AVAILABLE") return "bg-green-700 hover:bg-green-800";
      if (hoveredStatus === "IF_NEEDED")
        return "bg-yellow-400 hover:bg-yellow-500 relative";
      return "bg-muted/80 hover:bg-muted";
    }

    if (mine === "AVAILABLE") return "bg-green-700 hover:bg-green-800";
    if (mine === "IF_NEEDED")
      return "bg-yellow-400 hover:bg-yellow-500 relative";

    if (isCalendarUnavailable) {
      return "bg-rose-900/40 hover:bg-rose-900/55 border border-rose-900/60";
    }

    if (isEditing) return "bg-red-300 hover:bg-red-200";

    if (showHeatmap) return getHeatmapColor(key);

    return "bg-muted/80 hover:bg-muted";
  }

  function triggerPrimaryBlink() {
    setPrimaryBlinkNonce((n) => n + 1);
  }

  function handleCellMouseDown(date: string, time: string) {
    if (readOnly || !canParticipate) return;
    const key = `${date}|${time}`;
    if (!isEditingRef.current) {
      triggerPrimaryBlink();
      return;
    }

    const visual = getCellVisual(
      key,
      selectedRef.current,
      isEditingRef.current,
    );
    const action = resolveDragAction(fillModeRef.current, visual);
    if (!action) return;

    dragActionRef.current = action;
    isDraggingRef.current = true;
    paintedSlotsRef.current = new Set([key]);
    setPaintedSlots(new Set([key]));
    lastPaintedRef.current = { date, time };
  }

  const applyPaintRange = useCallback(
    (date: string, time: string) => {
      if (!isDraggingRef.current || !dragActionRef.current) return;
      const last = lastPaintedRef.current;
      const keys = last
        ? getSlotKeysInRange(
            last.date,
            last.time,
            date,
            time,
            visibleDates,
            slots,
          )
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
    },
    [visibleDates, slots],
  );

  useEffect(() => {
    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current || !dragActionRef.current) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const btn = el?.closest("[data-slot-key]") as HTMLButtonElement | null;
      const slotKey = btn?.dataset.slotKey;
      if (!slotKey) return;
      const i = slotKey.indexOf("|");
      if (i === -1) return;
      applyPaintRange(slotKey.slice(0, i), slotKey.slice(i + 1));
    };
    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [applyPaintRange]);

  function handleCellMouseEnter(date: string, time: string) {
    applyPaintRange(date, time);
  }

  function addAvailability() {
    if (!canParticipate || readOnly || saved) return;
    const next: Record<string, SlotStatus> = { ...selected };
    for (const d of dates) {
      for (const t of slots) {
        const key = `${d}|${t}`;
        if (!calendarUnavailable[key]) next[key] = "AVAILABLE";
      }
    }
    setFillingWave(true);
    setSelected(next);
    setIsEditing(true);
    const maxDelay =
      (Math.max(visibleDates.length, 1) + Math.max(slots.length, 1)) * 15 + 220;
    window.setTimeout(() => setFillingWave(false), maxDelay);
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Kunne ikke kopiere lenken.");
    }
  }

  function handleLockedModePrimaryClick() {
    if (!canParticipate || readOnly) return;
    if (saved) {
      setIsEditing(true);
    } else {
      addAvailability();
    }
  }

  function cancelAvailabilityEdit() {
    setSelected({ ...persistedSelected });
    setIsEditing(false);
  }

  async function submitAvailability() {
    if (!signedInUserName?.trim()) return;
    const payload = Object.entries(selected)
      .map(([key, status]) => {
        const [date, time] = key.split("|");
        return { date, time, status };
      });
    try {
      const res = await saveAvailability({
        eventSlug: slug,
        participantId,
        participantName: signedInUserName.trim(),
        slots: payload,
      });
      localStorage.setItem(`participant_${slug}`, res.participantId);
      setParticipantId(res.participantId);
      setSaved(true);
      setIsEditing(false);
      setPersistedSelected(selected);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lagring feilet.";
      if (message.includes("Innloggingen er ikke gyldig lenger")) {
        alert(`${message} Du blir sendt til innlogging.`);
        window.location.assign("/");
        return;
      }
      alert(message);
    }
  }

  const syncGoogleCalendar = useCallback(async () => {
    const res = await fetch("/api/sync-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });

    let errorPayload:
      | {
          error?: string;
          requiresReconnect?: boolean;
        }
      | undefined;
    if (!res.ok) {
      try {
        errorPayload = (await res.json()) as {
          error?: string;
          requiresReconnect?: boolean;
        };
      } catch {
        errorPayload = undefined;
      }
    }

    if (res.status === 400 && errorPayload?.requiresReconnect) {
      window.location.assign(
        `/api/google-calendar/connect?returnTo=${encodeURIComponent(`/event/${slug}?calendarSync=1`)}`,
      );
      return;
    }

    if (!res.ok) {
      let message = "Synkronisering feilet.";
      if (errorPayload?.error) message = errorPayload.error;
      alert(message);
      return;
    }
    const data = (await res.json()) as {
      blocked: string[];
      events?: SyncCalendarEvent[];
    };
    const blockedMap = Object.fromEntries(data.blocked.map((k) => [k, true]));
    setCalendarUnavailable(blockedMap);
    setCalendarEvents(Array.isArray(data.events) ? data.events : []);
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendarSync") !== "1") return;
    if (!signedInUserId) return;

    setIsEditing(true);
    void syncGoogleCalendar();

    params.delete("calendarSync");
    const qs = params.toString();
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [signedInUserId, syncGoogleCalendar]);

  return (
    <div className="space-y-4">
      {!canParticipate ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Logg inn for å fylle ut tilgjengelighet</p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-200/90">
            Du må være innlogget for å legge inn tider og lagre.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block text-sm font-medium text-primary underline"
          >
            Gå til innlogging
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
          >
            {copied ? "Kopiert!" : "Del lenke"}
          </button>
          {signedInUserId ? (
            <div className="flex min-w-0 flex-col">
              <button
                type="button"
                onClick={syncGoogleCalendar}
                disabled={!canParticipate || readOnly}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Synkroniser Google Kalender
              </button>
              <p className="mt-1 text-xs text-muted-foreground">
                Kalenderaktiviteter markeres som utilgjengelige, men kan
                overstyres med klikk.
              </p>
            </div>
          ) : null}
          <p className="min-w-0 shrink text-sm text-muted-foreground">
            {saved ? "Lagret." : "Ikke lagret ennå."}
          </p>
          {isEditing ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <button
                type="button"
                onClick={cancelAvailabilityEdit}
                disabled={readOnly || !canParticipate}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => void submitAvailability()}
                disabled={
                  readOnly ||
                  !canParticipate ||
                  !hasUnsavedChanges
                }
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Lagre
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLockedModePrimaryClick}
              disabled={readOnly || !canParticipate}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:ml-auto sm:w-auto"
            >
              <span
                key={primaryBlinkNonce}
                className={
                  primaryBlinkNonce > 0
                    ? "inline-block primary-button-nudge"
                    : "inline-block"
                }
              >
                {saved ? "Endre tilgjengelighet" : "Legg til tilgjengelighet"}
              </span>
            </button>
          )}
        </div>

        {pages > 1 && (
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
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
              type="button"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              className="rounded border border-border px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"
            >
              Neste →
            </button>
          </div>
        )}

        <div
          className="flex flex-col gap-3 lg:flex-row lg:items-stretch"
          onMouseLeave={() => setHoveredParticipantId(null)}
        >
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div
              className="relative grid min-w-full select-none gap-0 text-sm"
              style={{
                touchAction: "manipulation",
                gridTemplateColumns: `56px repeat(${visibleDates.length}, minmax(${narrowGrid ? 72 : 80}px, 1fr))`,
                gridTemplateRows: `40px repeat(${slots.length}, 32px)`,
              }}
            >
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

              {slots.map((time, timeIdx) => {
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
                      const isCalendarUnavailable = calendarUnavailable[key];

                      const staggerMs =
                        fillingWave && canParticipate
                          ? (dateIndex + timeIdx) * 15
                          : 0;
                      const transitionStyle = fillingWave
                        ? {
                            transition: "background-color 200ms ease-out",
                            transitionDelay: `${staggerMs}ms`,
                          }
                        : undefined;

                      const hoverActive = Boolean(
                        hoveredParticipantId && !isEditing && hoveredSlots,
                      );
                      const hoveredStatus =
                        hoverActive && hoveredSlots
                          ? hoveredSlots[key]
                          : undefined;
                      const hoveredParticipant = hoveredParticipantId
                        ? participants.find((x) => x.id === hoveredParticipantId)
                        : undefined;

                      const colorClass = cellBackgroundClass({
                        key,
                        mine,
                        isPainted,
                        isCalendarUnavailable,
                        hoverActive,
                        hoveredStatus,
                      });

                      const people = peopleByCell[key] ?? [];
                      const tooltip = hoverActive && hoveredParticipant
                        ? hoveredStatus
                          ? `${hoveredParticipant.name}: ${hoveredStatus === "AVAILABLE" ? "Tilgjengelig" : "Om nødvendig"}`
                          : `${hoveredParticipant.name}: ikke tilgjengelig`
                        : people.length
                          ? people
                              .map(
                                (p) =>
                                  `${p.name}: ${p.status === "AVAILABLE" ? "Tilgjengelig" : "Om nødvendig"}`,
                              )
                              .join("\n")
                          : "Ingen ennå";

                      const interactive =
                        !readOnly && canParticipate && isEditing;
                      const cellDisabled =
                        readOnly || !canParticipate;
                      const cellAriaDisabled = !interactive;

                      return (
                        <button
                          key={key}
                          type="button"
                          data-slot-key={key}
                          title={tooltip}
                          style={transitionStyle}
                          tabIndex={interactive ? 0 : -1}
                          aria-disabled={cellAriaDisabled}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            handleCellMouseDown(date, time);
                          }}
                          onMouseEnter={() => handleCellMouseEnter(date, time)}
                          onClick={(e) => {
                            if (!interactive) e.preventDefault();
                          }}
                          disabled={cellDisabled}
                          className={`relative block h-full w-full min-w-0 border-b border-r border-border p-0 leading-none ${colorClass} ${interactive || hoverActive ? "cursor-pointer" : "cursor-default"} ${dateIndex === 0 ? "border-l" : ""}`}
                        >
                          {(mine === "IF_NEEDED" ||
                            (hoverActive && hoveredStatus === "IF_NEEDED")) &&
                          !isPainted ? (
                            <span
                              className="pointer-events-none absolute inset-0 opacity-40"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(135deg, rgba(234,179,8,0.55), rgba(234,179,8,0.55) 4px, transparent 4px, transparent 8px)",
                              }}
                            />
                          ) : null}
                        </button>
                      );
                    })}
                  </Fragment>
                );
              })}
              {calendarOverlayPlacements.map((p) => (
                <div
                  key={p.key}
                  className="pointer-events-none min-w-0 overflow-hidden border border-primary/40 bg-primary/10 px-0.5 py-0.5 text-left text-[10px] leading-tight text-primary"
                  style={{
                    gridColumn: `${p.dateCol + 2} / ${p.dateCol + 3}`,
                    gridRow: `${p.rowStart} / ${p.rowEnd}`,
                    zIndex: p.zIndex,
                    marginLeft: p.layer * 3,
                    marginRight: p.layer * 3,
                  }}
                >
                  <span className="line-clamp-2">{p.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 border border-border bg-muted/40 p-3 lg:w-52">
            <div
              className="flex flex-row items-center justify-center gap-2 lg:flex-col lg:justify-start"
              role="group"
              aria-label="Fyllmodus"
            >
              <span className="text-xs font-medium text-muted-foreground lg:mb-1">
                Modus
              </span>
              <div className="flex flex-row gap-2 lg:flex-col lg:gap-3">
                <button
                  type="button"
                  onClick={() => setFillMode("AVAILABLE")}
                  disabled={!canParticipate || readOnly || !isEditing}
                  className={`flex min-h-[72px] flex-1 flex-col items-center justify-center rounded-md border-2 px-3 py-2 text-center text-xs font-medium transition-colors lg:w-full ${fillMode === "AVAILABLE" ? "border-green-700 bg-green-700 text-white" : "border-border bg-card text-card-foreground hover:bg-muted"}`}
                >
                  <span className="mb-1 h-3 w-3 rounded-full bg-green-700 ring-2 ring-green-800/30" />
                  Tilgjengelig
                </button>
                <button
                  type="button"
                  onClick={() => setFillMode("IF_NEEDED")}
                  disabled={!canParticipate || readOnly || !isEditing}
                  className={`flex min-h-[72px] flex-1 flex-col items-center justify-center rounded-md border-2 px-3 py-2 text-center text-xs font-medium transition-colors lg:w-full ${fillMode === "IF_NEEDED" ? "border-yellow-500 bg-yellow-400 text-yellow-950" : "border-border bg-card text-card-foreground hover:bg-muted"}`}
                >
                  <span className="mb-1 h-3 w-3 rounded-full bg-yellow-400 ring-2 ring-yellow-600/30" />
                  Om nødvendig
                </button>
              </div>
            </div>

            <div
              className="min-w-0 border-t border-border pt-3"
              aria-label="Deltakere med tilgjengelighet"
            >
              <span className="text-xs font-medium text-muted-foreground">
                Deltakere
              </span>
              {participantsWithAvailability.length > 0 ? (
                <ul className="mt-2 list-none space-y-1">
                  {participantsWithAvailability.map((p) => (
                    <li
                      key={p.id}
                      className="min-w-0 cursor-pointer wrap-break-word text-sm text-card-foreground"
                      onMouseEnter={() => setHoveredParticipantId(p.id)}
                      onPointerDown={(e) => {
                        if (e.pointerType !== "touch") return;
                        setHoveredParticipantId((id) =>
                          id === p.id ? null : p.id,
                        );
                      }}
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ingen har lagret ennå
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

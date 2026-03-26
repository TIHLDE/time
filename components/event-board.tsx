"use client";

import { useEffect, useMemo, useState } from "react";
import type { SlotStatus } from "@prisma/client";
import { buildTimeSlots, toPrettyTime } from "@/lib/time";
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
  participants: ParticipantSeed[];
};

type FillMode = "AVAILABLE" | "IF_NEEDED";

export function EventBoard({
  slug,
  dates,
  startTime,
  endTime,
  slotDuration,
  deadline,
  signedInUserId,
  participants,
}: EventBoardProps) {
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [fillMode, setFillMode] = useState<FillMode>("AVAILABLE");
  const [includeIfNeeded, setIncludeIfNeeded] = useState(true);
  const [selected, setSelected] = useState<Record<string, SlotStatus>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const [page, setPage] = useState(0);

  const readOnly = Boolean(deadline && new Date() > new Date(deadline));
  const slots = useMemo(() => buildTimeSlots(startTime, endTime, slotDuration), [startTime, endTime, slotDuration]);
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
      Object.fromEntries(picked.slots.map((slot) => [`${slot.date}|${slot.time}`, slot.status])),
    );
  }, [participants, signedInUserId, slug]);

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
        map[key] = [...(map[key] ?? []).filter((r) => r.name !== name), { name, status }];
      }
    }
    return map;
  }, [participants, selected, name]);

  const intensity = (key: string) => {
    const list = peopleByCell[key] ?? [];
    const count = list.filter((entry) =>
      includeIfNeeded ? true : entry.status === "AVAILABLE",
    ).length;
    if (count === 0) return "bg-zinc-100";
    if (count === 1) return "bg-green-200";
    if (count === 2) return "bg-green-300";
    if (count === 3) return "bg-green-400";
    return "bg-green-500 text-white";
  };

  const paintCell = (key: string) => {
    if (readOnly || busy[key]) return;
    setSelected((prev) => ({
      ...prev,
      [key]: fillMode,
    }));
  };

  async function submitAvailability() {
    if (!name.trim()) {
      alert("Please enter your name.");
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
      alert("Sync failed.");
      return;
    }
    const data = (await res.json()) as { blocked: string[] };
    const blockedMap = Object.fromEntries(data.blocked.map((k) => [k, true]));
    setBusy(blockedMap);
    setSelected((prev) => {
      const next = { ...prev };
      for (const key of data.blocked) {
        delete next[key];
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-md border border-zinc-300 px-3 py-2"
            disabled={readOnly}
          />
          <button
            onClick={submitAvailability}
            disabled={readOnly}
            className="rounded-md bg-zinc-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save availability
          </button>
          {signedInUserId ? (
            <button
              onClick={syncGoogleCalendar}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100"
            >
              Sync Google Calendar
            </button>
          ) : null}
          <p className="text-sm text-zinc-500">{saved ? "Saved. You can keep editing." : "Not saved yet."}</p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span>Fill mode:</span>
            <button
              onClick={() => setFillMode("AVAILABLE")}
              className={`rounded-md px-2 py-1 ${fillMode === "AVAILABLE" ? "bg-green-600 text-white" : "bg-zinc-100"}`}
            >
              Available
            </button>
            <button
              onClick={() => setFillMode("IF_NEEDED")}
              className={`rounded-md px-2 py-1 ${fillMode === "IF_NEEDED" ? "bg-green-200 text-zinc-900" : "bg-zinc-100"}`}
            >
              If needed
            </button>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeIfNeeded}
              onChange={(e) => setIncludeIfNeeded(e.target.checked)}
            />
            Include if-needed slots
          </label>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <p className="text-sm text-zinc-500">
            Showing days {page * 7 + 1}-{Math.min(page * 7 + 7, dates.length)} of {dates.length}
          </p>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            className="rounded-md border border-zinc-300 px-2 py-1 text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>

        <div className="overflow-auto">
          <div
            className="grid min-w-[680px]"
            style={{ gridTemplateColumns: `120px repeat(${visibleDates.length}, minmax(80px, 1fr))` }}
            onPointerUp={() => setDragging(false)}
            onPointerLeave={() => setDragging(false)}
          >
            <div className="border-b border-r border-zinc-200 p-2 text-xs font-medium text-zinc-500">Time</div>
            {visibleDates.map((date) => (
              <div key={date} className="border-b border-r border-zinc-200 p-2 text-center text-xs font-medium">
                {date}
              </div>
            ))}
            {slots.map((time) => (
              <div key={time} className="contents">
                <div className="border-b border-r border-zinc-200 p-2 text-xs text-zinc-600">{toPrettyTime(time)}</div>
                {visibleDates.map((date) => {
                  const key = `${date}|${time}`;
                  const mine = selected[key];
                  const people = peopleByCell[key] ?? [];
                  const tooltip = people.length
                    ? people.map((p) => `${p.name}: ${p.status === "AVAILABLE" ? "Available" : "If needed"}`).join("\n")
                    : "No one yet";
                  const striped = mine === "IF_NEEDED";
                  const mineStyle = mine === "AVAILABLE" ? "bg-green-600" : striped ? "bg-green-200" : "";
                  return (
                    <button
                      type="button"
                      key={key}
                      title={tooltip}
                      onPointerDown={() => {
                        setDragging(true);
                        paintCell(key);
                      }}
                      onPointerEnter={() => {
                        if (dragging) {
                          paintCell(key);
                        }
                      }}
                      className={`relative h-9 border-b border-r border-zinc-200 transition ${busy[key] ? "bg-zinc-300" : intensity(key)} ${mineStyle}`}
                    >
                      {striped ? (
                        <span
                          className="absolute inset-0 opacity-35"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(135deg, rgba(16,185,129,0.35), rgba(16,185,129,0.35) 6px, transparent 6px, transparent 12px)",
                          }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isToday,
  startOfMonth,
  startOfToday,
  subMonths,
} from "date-fns";
import { nb } from "date-fns/locale";
import { createEvent } from "@/app/actions";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  const value = `${String(h).padStart(2, "0")}:${m}`;
  const label = `${h}:${m}`;
  return { value, label };
});

export function CreateEventForm() {
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitted, setSubmitted] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<"add" | "remove">("add");
  const today = startOfToday();

  const titleError = title.trim().length < 2;
  const datesError = dates.length === 0;
  const showErrors = submitted;

  useEffect(() => {
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  function handleDayMouseDown(d: Date) {
    if (isBefore(d, today)) return;
    const str = format(d, "yyyy-MM-dd");
    const isSelected = dates.includes(str);
    dragModeRef.current = isSelected ? "remove" : "add";
    isDraggingRef.current = true;
    setDates((prev) =>
      isSelected ? prev.filter((x) => x !== str) : [...prev, str].sort(),
    );
  }

  function handleDayMouseEnter(d: Date) {
    if (!isDraggingRef.current || isBefore(d, today)) return;
    const str = format(d, "yyyy-MM-dd");
    setDates((prev) => {
      if (dragModeRef.current === "add") {
        return prev.includes(str) ? prev : [...prev, str].sort();
      }
      return prev.filter((x) => x !== str);
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (titleError || datesError) return;
    const fd = new FormData(e.currentTarget);
    await createEvent(fd);
  }

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOffset = (getDay(monthStart) + 6) % 7;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-semibold">Nytt arrangement</h1>
        <p className="text-sm text-muted-foreground">Perfekt for engangs- eller faste møter</p>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTitleTouched(true)}
          placeholder="Gi arrangementet et navn..."
          className={`w-full rounded-md border bg-card px-3 py-2.5 text-sm focus:outline-none ${(titleTouched || showErrors) && titleError ? "border-red-400 focus:border-red-400" : "border-border focus:ring-2 focus:ring-primary/25"}`}
        />
        {(titleTouched || showErrors) && titleError && (
          <p className="text-xs text-red-500">Navn på arrangement er påkrevd</p>
        )}
      </div>

      {/* Time range */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-card-foreground">Hvilke tider kan passe?</h2>
        <div className="flex items-center gap-3">
          <select
            name="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">til</span>
          <select
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar date picker */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-card-foreground">Hvilke datoer kan passe?</h2>
        <p className="text-xs text-muted-foreground">Dra for å velge flere datoer</p>

        <div
          className="select-none rounded-md border border-border p-4"
          onMouseLeave={() => {
            isDraggingRef.current = false;
          }}
        >
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="flex h-7 w-7 items-center justify-center rounded text-lg text-muted-foreground hover:bg-muted"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-card-foreground">
              {format(viewMonth, "MMMM yyyy", { locale: nb })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="flex h-7 w-7 items-center justify-center rounded text-lg text-muted-foreground hover:bg-muted"
            >
              ›
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
            {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOffset }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {daysInMonth.map((d) => {
              const str = format(d, "yyyy-MM-dd");
              const isPast = isBefore(d, today);
              const isSelected = dates.includes(str);
              const isTodayDate = isToday(d);
              return (
                <button
                  key={str}
                  type="button"
                  onMouseDown={() => handleDayMouseDown(d)}
                  onMouseEnter={() => handleDayMouseEnter(d)}
                  disabled={isPast}
                  className={[
                    "flex h-9 w-full items-center justify-center rounded text-sm transition-colors",
                    isPast
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : "cursor-pointer",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : !isPast && isTodayDate
                        ? "font-bold text-card-foreground hover:bg-muted"
                        : !isPast
                          ? "text-card-foreground hover:bg-muted"
                          : "",
                  ].join(" ")}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>

        {showErrors && datesError && (
          <p className="text-xs text-red-500">Velg minst én dato</p>
        )}

        {/* Hidden inputs for form submission */}
        {dates.map((date) => (
          <input key={date} type="hidden" name="dates" value={date} />
        ))}
      </div>

      {/* Submit */}
      <div className="space-y-2">
        <button
          type="submit"
          className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Opprett arrangement
        </button>
        {showErrors && (titleError || datesError) && (
          <p className="text-center text-xs text-red-500">
            Rett opp feil i skjemaet før du fortsetter
          </p>
        )}
      </div>
    </form>
  );
}

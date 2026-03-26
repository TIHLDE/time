"use client";

import { useState } from "react";
import { createEvent } from "@/app/actions";

export function CreateEventForm() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");

  return (
    <form action={createEvent} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">Create event</h1>
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
          placeholder="Team offsite planning"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="date" className="text-sm font-medium text-zinc-700">
          Add dates
        </label>
        <div className="flex gap-2">
          <input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => {
              if (!selectedDate || dates.includes(selectedDate)) return;
              setDates((prev) => [...prev, selectedDate].sort());
              setSelectedDate("");
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            Add date
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {dates.map((date) => (
            <span
              key={date}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-sm"
            >
              {date}
              <button
                type="button"
                className="text-zinc-500"
                onClick={() => setDates((prev) => prev.filter((d) => d !== date))}
              >
                x
              </button>
              <input type="hidden" name="dates" value={date} />
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="startTime" className="text-sm font-medium text-zinc-700">
            Start time
          </label>
          <input
            id="startTime"
            type="time"
            name="startTime"
            defaultValue="09:00"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="endTime" className="text-sm font-medium text-zinc-700">
            End time
          </label>
          <input
            id="endTime"
            type="time"
            name="endTime"
            defaultValue="18:00"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="deadline" className="text-sm font-medium text-zinc-700">
          Deadline (optional)
        </label>
        <input id="deadline" type="date" name="deadline" className="rounded-md border border-zinc-300 px-3 py-2" />
      </div>

      <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800">
        Create and share
      </button>
    </form>
  );
}

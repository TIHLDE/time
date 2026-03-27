import type { SlotStatus } from "@prisma/client";

export type SlotInput = {
  date: string;
  time: string;
  status: SlotStatus;
};

export type CellEntry = {
  participantId: string;
  name: string;
  status: SlotStatus;
};

/** Google Calendar overlay segment returned by POST /api/sync-calendar */
export type SyncCalendarEvent = {
  title: string;
  start: string;
  end: string;
};

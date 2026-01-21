import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { addDays } from 'date-fns';
import type {
  DayCellContentArg,
  DayCellMountArg,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventMountArg
} from '@fullcalendar/core';
import type { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction';
import '@/index.css';
import '@/styles/fullcalendar.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { useQuery } from '@tanstack/react-query';
import type { SafeUser } from '@shared/schema';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

interface EventResource {
  name: string;
  status: 'pending' | 'confirmed';
}

type WeekData = { weekNumber: number; days: Date[] };

const stripTime = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const startOfWeek = (d: Date) => {
  const date = stripTime(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  date.setDate(date.getDate() + diff);
  return date;
};

const getMonthWeeks = (year: number, month: number): WeekData[] => {
  const weeks: WeekData[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let cursor = startOfWeek(firstDay);
  let weekNum = 1;

  while (cursor <= lastDay || weeks.length < 5) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() + i);
      return day;
    });
    weeks.push({ weekNumber: weekNum, days });
    weekNum++;
    cursor.setDate(cursor.getDate() + 7);
    if (weeks.length >= 6) break;
  }
  return weeks;
};

const formatDayLabel = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  return `${dd}${mm}${yy} ${weekday}`;
};

interface Event {
  id: string;
  title: string;
  date: Date | string;
  endDate?: Date | string;
  category?: string;
  time?: string;
  notes?: string;
  resources?: EventResource[];
}

const SAMPLE_EVENTS: Event[] = [
  {
    id: 'sample-2',
    title: 'Logistics Readiness Drill',
    date: '2026-01-09',
    category: 'Maintenance',
    time: '0900-1200',
  },
  {
    id: 'sample-3',
    title: 'Forward Ops Briefing',
    date: '2026-01-12',
    endDate: '2026-01-13',
    category: 'Operations',
    time: '1300-1600',
  },
  {
    id: 'sample-4',
    title: 'Admin Inspection',
    date: '2026-01-15',
    category: 'Administration',
    time: '1000-1130',
  },
  {
    id: 'sample-5',
    title: 'Joint Exercise (Bravo)',
    date: '2026-01-18',
    endDate: '2026-01-20',
    category: 'Operations',
    time: 'All Day',
  },
  {
    id: 'sample-6',
    title: 'BME OPFOR',
    date: '2026-01-22',
    endDate: '2026-01-24',
    category: 'Training',
    time: 'All Day',
  },
];

const ResourceWatch = ({ events }: { events: Event[] }) => {
  const pendingEvents = useMemo(
    () => events.filter((event) => event.resources?.some((r) => r.status !== 'confirmed')),
    [events]
  );

  const pendingCount = pendingEvents.reduce((acc, event) => {
    const open = event.resources?.filter((r) => r.status !== 'confirmed').length ?? 0;
    return acc + open;
  }, 0);

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          Resource Watch
        </CardTitle>
        <p className="text-xs text-muted-foreground">Track outstanding confirmations across missions.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm font-medium text-foreground">
          {pendingCount} pending {pendingCount === 1 ? 'task' : 'tasks'}
        </div>
        {pendingEvents.length === 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            All resources confirmed. You're clear.
          </div>
        )}
        {pendingEvents.map((event) => {
          const outstanding = event.resources?.filter((r) => r.status !== 'confirmed').length ?? 0;
          return (
            <div
              key={event.id}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-[0_4px_12px_rgba(251,191,36,0.18)]"
            >
              <div className="font-semibold">{event.title}</div>
              <div className="text-xs text-amber-700">
                {outstanding} {outstanding === 1 ? 'item' : 'items'} awaiting confirmation
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

const isSampleEvent = (eventId: string) => eventId.startsWith('sample');

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toInclusiveEndDate = (end: Date | null, allDay: boolean) => {
  if (!end) return undefined;
  const adjusted = new Date(end);
  if (allDay) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted;
};

const generateLocalEventId = () => `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function ForecastPage() {
  const { data: user, isLoading: userLoading } = useQuery<SafeUser>({
    queryKey: ['/api/auth/me'],
  });
  const [, setLocation] = useLocation();
  const calendarRef = useRef<FullCalendar | null>(null);
  const multiDayEventGroupsRef = useRef<Map<string, { maxHeight: number; elements: Set<HTMLElement> }>>(new Map());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [isMobile, setIsMobile] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [weekLabels, setWeekLabels] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Event[]>(() => [...SAMPLE_EVENTS]);
  const weeklyCalendarEvents = useMemo(() => {
    return events.map((event) => {
      // Parse as local time by appending T00:00:00 to avoid UTC interpretation
      const dateStr = typeof event.date === 'string' ? event.date : formatDateInput(new Date(event.date));
      const start = new Date(dateStr + 'T00:00:00');

      const endDateStr = event.endDate
        ? (typeof event.endDate === 'string' ? event.endDate : formatDateInput(new Date(event.endDate)))
        : dateStr;
      const end = new Date(endDateStr + 'T00:00:00');
      end.setDate(end.getDate() + 1); // FullCalendar all-day uses exclusive end

      return {
        id: event.id,
        title: event.title,
        start,
        end,
        allDay: true,
        extendedProps: {
          category: event.category,
          time: event.time
        }
      };
    });
  }, [events]);
  const [newEventForm, setNewEventForm] = useState({
    title: '',
    date: '',
    endDate: '',
    category: 'Training',
    time: '',
    notes: ''
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventFormMessage, setEventFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRangeStart, setPendingRangeStart] = useState<Date | null>(null);
  const [rangeHoverDate, setRangeHoverDate] = useState<Date | null>(null);
  const pendingRangeStartRef = useRef<Date | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    pendingRangeStartRef.current = pendingRangeStart;
  }, [pendingRangeStart]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('week');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (viewMode !== 'month') {
      setPendingRangeStart(null);
      setRangeHoverDate(null);
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'month') {
      setPendingRangeStart(null);
      setRangeHoverDate(null);
    }
  }, [viewMode]);

  const normalizeMultiDaySegments = useCallback((key: string, element: HTMLElement, height: number) => {
    const existing = multiDayEventGroupsRef.current.get(key) ?? { maxHeight: 0, elements: new Set<HTMLElement>() };
    existing.elements.add(element);

    if (height > existing.maxHeight) {
      existing.maxHeight = height;
      existing.elements.forEach((el) => {
        el.style.minHeight = `${height}px`;
      });
    } else if (existing.maxHeight > 0) {
      element.style.minHeight = `${existing.maxHeight}px`;
    }

    multiDayEventGroupsRef.current.set(key, existing);
  }, []);

  const handleMultiDayEventMount = useCallback((info: EventMountArg) => {
    const { event, el } = info;
    if (!event.start || !event.end || !event.allDay) return;

    const duration = event.end.getTime() - event.start.getTime();
    if (duration <= 24 * 60 * 60 * 1000) return;

    const eventKey = `${event.id}-${event.start?.toISOString() ?? ''}-${event.end?.toISOString() ?? ''}`;
    if (!eventKey) return;

    const element = el as HTMLElement;
    element.dataset.eventKey = eventKey;

    requestAnimationFrame(() => {
      const measuredHeight = element.offsetHeight;
      if (measuredHeight === 0) return;
      normalizeMultiDaySegments(eventKey, element, measuredHeight);
    });
  }, [normalizeMultiDaySegments]);

  const handleMultiDayEventWillUnmount = useCallback((info: EventMountArg) => {
    const eventKey = `${info.event.id}-${info.event.start?.toISOString() ?? ''}-${info.event.end?.toISOString() ?? ''}`;
    if (!eventKey) return;

    const entry = multiDayEventGroupsRef.current.get(eventKey);
    if (!entry) return;

    const element = info.el as HTMLElement;
    entry.elements.delete(element);
    element.style.removeProperty('min-height');

    if (entry.elements.size === 0) {
      multiDayEventGroupsRef.current.delete(eventKey);
    } else {
      multiDayEventGroupsRef.current.set(eventKey, entry);
    }
  }, []);

  useEffect(() => {
    multiDayEventGroupsRef.current.forEach(({ elements }) => {
      elements.forEach((el) => {
        el.style.removeProperty('min-height');
      });
    });
    multiDayEventGroupsRef.current.clear();
  }, [weeklyCalendarEvents, viewMode, currentMonth]);

  // Update label when month changes
  useEffect(() => {
    if (viewMode === 'month') {
      const date = new Date(currentMonth.year, currentMonth.month, 1);
      setCurrentLabel(date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
    }
  }, [currentMonth, viewMode]);

  const monthWeeks = useMemo(() => {
    return getMonthWeeks(currentMonth.year, currentMonth.month);
  }, [currentMonth]);

  const getEventsForDay = useCallback((date: Date) => {
    const dayStart = stripTime(date).getTime();
    return events.filter((event) => {
      const eventStart = stripTime(new Date(event.date)).getTime();
      const eventEnd = event.endDate ? stripTime(new Date(event.endDate)).getTime() : eventStart;
      return dayStart >= eventStart && dayStart <= eventEnd;
    });
  }, [events]);

  const handleNewEventChange = (field: string, value: string) => {
    setNewEventForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEventFormMessage(null);
    if (!newEventForm.title.trim() || !newEventForm.date) {
      setEventFormMessage({ type: 'error', text: 'Title and start date are required.' });
      return;
    }
    setCreatingEvent(true);
    try {
      setEvents((prev) => [
        ...prev,
        {
          id: generateLocalEventId(),
          title: newEventForm.title.trim(),
          date: newEventForm.date,
          endDate: newEventForm.endDate || undefined,
          category: newEventForm.category || undefined,
          time: newEventForm.time || undefined,
          notes: newEventForm.notes || undefined
        }
      ]);
      setNewEventForm({
        title: '',
        date: '',
        endDate: '',
        category: 'Training',
        time: '',
        notes: ''
      });
      setEventFormMessage({ type: 'success', text: 'Event created successfully.' });
    } catch (err) {
      setEventFormMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create event.'
      });
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleQuickCreateEvent = useCallback(
    async (title: string, start: Date, end: Date | null) => {
      setEvents((prev) => [
        ...prev,
        {
          id: generateLocalEventId(),
          title: title.trim(),
          date: formatDateInput(start),
          endDate: end ? formatDateInput(toInclusiveEndDate(end, true) ?? start) : undefined
        }
      ]);
      setEventFormMessage({ type: 'success', text: 'Event created via calendar selection.' });
    },
    []
  );

  const persistEventDateChange = useCallback(
    async (eventId: string, start: Date, end: Date | null, allDay: boolean) => {
      const inclusiveEnd = toInclusiveEndDate(end, allDay);
      setEvents((prev) =>
        prev.map((evt) =>
          evt.id === eventId
            ? {
                ...evt,
                date: formatDateInput(start),
                endDate: inclusiveEnd ? formatDateInput(inclusiveEnd) : undefined
              }
            : evt
        )
      );
    },
    []
  );

  const rangePreview = useMemo(() => {
    if (!pendingRangeStart) return null;
    const effectiveEnd = rangeHoverDate ?? pendingRangeStart;
    const start = stripTime(pendingRangeStart <= effectiveEnd ? pendingRangeStart : effectiveEnd);
    const end = stripTime(pendingRangeStart <= effectiveEnd ? effectiveEnd : pendingRangeStart);
    return { start, end };
  }, [pendingRangeStart, rangeHoverDate]);

  const handleDateSelect = useCallback(
    async (selection: DateSelectArg) => {
      if (viewMode === 'month') {
        // Use custom multi-week selection via date clicks instead
        return;
      }
      const title = window.prompt('Enter a title for this event');
      const calendarApi = selection.view.calendar;
      calendarApi.unselect();
      if (!title || !selection.start) return;
      try {
        await handleQuickCreateEvent(title, selection.start, selection.end);
      } catch (err) {
        setEventFormMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to create event from selection.'
        });
      }
    },
    [handleQuickCreateEvent]
  );

  const handleDateClick = useCallback(
    async (info: DateClickArg) => {
      if (viewMode !== 'month') {
        setPendingRangeStart(null);
        setRangeHoverDate(null);
        return;
      }

      if (!pendingRangeStart) {
        setPendingRangeStart(info.date);
        setRangeHoverDate(info.date);
        setEventFormMessage({
          type: 'success',
          text: 'Start date selected. Click another day to finish the range.'
        });
        return;
      }

      const startDate = pendingRangeStart <= info.date ? pendingRangeStart : info.date;
      const endDate = pendingRangeStart >= info.date ? pendingRangeStart : info.date;
      const title = window.prompt('Enter a title for this event');
      setPendingRangeStart(null);
      setRangeHoverDate(null);
      if (!title || !title.trim()) return;

      try {
        await handleQuickCreateEvent(title, startDate, addDays(endDate, 1));
      } catch (err) {
        setEventFormMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to create event.'
        });
      }
    },
    [handleQuickCreateEvent, pendingRangeStart, setEventFormMessage, viewMode]
  );

  const handleEventClick = useCallback(
    async (clickInfo: EventClickArg) => {
      if (isSampleEvent(clickInfo.event.id)) {
        window.alert('Sample events are read-only. Try creating a new event to edit/delete.');
        return;
      }
      const shouldDelete = window.confirm(`Delete "${clickInfo.event.title}"?`);
      if (!shouldDelete) return;
      setEvents((prev) => prev.filter((evt) => evt.id !== clickInfo.event.id));
      setEventFormMessage({ type: 'success', text: 'Event deleted.' });
    },
    []
  );

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      if (!info.event.start) return;
      if (isSampleEvent(info.event.id)) {
        info.revert();
        window.alert('Sample events cannot be moved. Create a real event to try drag & drop.');
        return;
      }
      try {
        await persistEventDateChange(info.event.id, info.event.start, info.event.end, info.event.allDay);
        setEventFormMessage({ type: 'success', text: 'Event rescheduled.' });
      } catch (err) {
        info.revert();
        setEventFormMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to reschedule event.'
        });
      }
    },
    [persistEventDateChange]
  );

  const updateRangeHighlight = useCallback((hoverDate: Date | null) => {
    const start = pendingRangeStartRef.current;
    if (!start) {
      // Clear all highlights
      document.querySelectorAll('.fc-day--pending-range').forEach((el) => {
        el.classList.remove('fc-day--pending-range');
      });
      return;
    }

    const effectiveEnd = hoverDate ?? start;
    const rangeStart = stripTime(start <= effectiveEnd ? start : effectiveEnd);
    const rangeEnd = stripTime(start <= effectiveEnd ? effectiveEnd : start);

    document.querySelectorAll('.fc-daygrid-day').forEach((el) => {
      const dateAttr = el.getAttribute('data-date');
      if (!dateAttr) return;
      const cellDate = stripTime(new Date(dateAttr));
      if (cellDate >= rangeStart && cellDate <= rangeEnd) {
        el.classList.add('fc-day--pending-range');
      } else {
        el.classList.remove('fc-day--pending-range');
      }
    });
  }, []);

  useEffect(() => {
    updateRangeHighlight(rangeHoverDate);
  }, [rangeHoverDate, updateRangeHighlight]);

  useEffect(() => {
    if (!pendingRangeStart) {
      updateRangeHighlight(null);
    }
  }, [pendingRangeStart, updateRangeHighlight]);

  const handleDayCellDidMount = useCallback(
    (args: DayCellMountArg) => {
      if (viewMode !== 'month') return;
      const el = args.el as HTMLElement;

      const handleEnter = () => {
        if (pendingRangeStartRef.current) {
          setRangeHoverDate(args.date);
        }
      };

      const handleLeave = () => {
        // Don't clear on leave, let the next enter update it
      };

      el.addEventListener('mouseenter', handleEnter);
      el.addEventListener('mouseleave', handleLeave);
    },
    [viewMode]
  );

  const handleEventResize = useCallback(
    async (info: EventResizeDoneArg) => {
      if (!info.event.start) return;
      if (isSampleEvent(info.event.id)) {
        info.revert();
        window.alert('Sample events cannot be resized.');
        return;
      }
      try {
        await persistEventDateChange(info.event.id, info.event.start, info.event.end, info.event.allDay);
        setEventFormMessage({ type: 'success', text: 'Event duration updated.' });
      } catch (err) {
        info.revert();
        setEventFormMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to update duration.'
        });
      }
    },
    [persistEventDateChange]
  );

  const handlePrevNext = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentMonth((prev) => {
        const date = new Date(prev.year, prev.month + (direction === 'next' ? 1 : -1), 1);
        return { year: date.getFullYear(), month: date.getMonth() };
      });
    } else {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      api[direction]();
      setCurrentLabel(api.view.title);
    }
  };

  const handleChangeView = (mode: 'month' | 'week') => {
    if (isMobile) return;
    setViewMode(mode);
    if (mode === 'week') {
      // Sync FullCalendar to current month when switching
      setTimeout(() => {
        const api = calendarRef.current?.getApi();
        if (api) {
          api.gotoDate(new Date(currentMonth.year, currentMonth.month, 1));
          setCurrentLabel(api.view.title);
        }
      }, 0);
    }
  };

  const getWeekLabelKey = (weekNumber: number) => {
    return `${currentMonth.year}-${currentMonth.month}-${weekNumber}`;
  };

  const renderWeekCalendar = () => {
    return (
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridWeek"
            headerToolbar={false}
            height="auto"
            firstDay={1}
            weekends
            events={weeklyCalendarEvents}
            timeZone="Asia/Singapore"
            selectable
            selectMirror
            select={handleDateSelect}
            dateClick={handleDateClick}
            editable
            eventStartEditable
            eventResizableFromStart
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventDidMount={handleMultiDayEventMount}
            eventWillUnmount={handleMultiDayEventWillUnmount}
            dayCellDidMount={handleDayCellDidMount}
            datesSet={(info) => {
              setCurrentLabel(info.view.title);
            }}
          />
        </CardContent>
      </Card>
    );
  };

  const renderMonthCalendar = () => {
    return (
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        {monthWeeks.map((week, weekIdx) => {
          const labelKey = getWeekLabelKey(week.weekNumber);
          const customLabel = weekLabels[labelKey];
          const weekStart = new Date(week.days[0]);
          const weekEnd = new Date(week.days[6]);
          const weekVisibleEnd = addDays(weekEnd, 1);

          // Filter events that overlap this week - let FullCalendar handle rendering
          const weekEvents = weeklyCalendarEvents.filter((event) => {
            const eventStartTime = event.start.getTime();
            const eventEndTime = event.end.getTime();
            const weekStartTime = weekStart.getTime();
            const weekVisibleEndTime = weekVisibleEnd.getTime();
            return eventStartTime < weekVisibleEndTime && eventEndTime > weekStartTime;
          });

          const dayCellContent = (args: DayCellContentArg) => {
            const label = formatDayLabel(args.date);
            return {
              html: `<div class="fc-daygrid-day-label">${label}</div>`,
            };
          };

          const dayCellClassNames = (args: DayCellContentArg) => {
            const classes: string[] = [];
            if (args.date.getMonth() !== currentMonth.month) {
              classes.push('fc-day--muted');
            }
            return classes;
          };

          return (
            <div key={week.weekNumber} className={weekIdx > 0 ? 'border-t border-border' : ''}>
              <div className="flex items-center justify-center bg-muted/40 px-4 py-2">
                <input
                  type="text"
                  placeholder="-"
                  value={customLabel || ''}
                  onChange={(e) => setWeekLabels((prev) => ({ ...prev, [labelKey]: e.target.value }))}
                  className="bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none text-center w-full"
                />
              </div>

              <div className="px-0">
                <FullCalendar
                  key={`week-${week.weekNumber}`}
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridWeek"
                  headerToolbar={false}
                  height="auto"
                  firstDay={1}
                  weekends
                  events={weekEvents}
                  timeZone="Asia/Singapore"
                  selectable
                  selectMirror
                  select={handleDateSelect}
                  dateClick={handleDateClick}
                  editable
                  eventStartEditable
                  eventResizableFromStart
                  eventClick={handleEventClick}
                  eventDrop={handleEventDrop}
                  eventResize={handleEventResize}
                  eventDidMount={handleMultiDayEventMount}
                  eventWillUnmount={handleMultiDayEventWillUnmount}
                  initialDate={weekStart}
                  dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                  showNonCurrentDates
                  fixedWeekCount={false}
                  dayCellContent={dayCellContent}
                  dayCellClassNames={dayCellClassNames}
                  dayCellDidMount={handleDayCellDidMount}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCalendar = () => {
    return viewMode === 'month' ? renderMonthCalendar() : renderWeekCalendar();
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Skeleton className="h-24 w-24" />
      </div>
    );
  }

  if (!user) {
    setLocation('/login');
    return null;
  }

  const isRestricted = user.role !== 'admin';

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Navbar user={user} pageTitle="Forecast" />
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 pt-24 transition duration-200 ${
          isRestricted ? 'pointer-events-none blur-sm' : ''
        }`}
      >
        <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Commander Forecast</p>
              <div>
                <h1 className="text-3xl font-semibold leading-tight text-foreground">Calendar Overview</h1>
                <p className="text-sm text-muted-foreground">
                  Simple rotation-focused planning with multi-day visibility.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!isMobile && (
                <div className="flex rounded-full border border-border bg-muted/60 p-1">
                  <Button
                    variant={viewMode === 'week' ? 'default' : 'ghost'}
                    size="sm"
                    className={viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
                    onClick={() => handleChangeView('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={viewMode === 'month' ? 'default' : 'ghost'}
                    size="sm"
                    className={viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
                    onClick={() => handleChangeView('month')}
                  >
                    Month
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => handlePrevNext('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">{currentLabel || ' '}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handlePrevNext('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>{renderCalendar()}</div>
          <div className="space-y-4">
            <Card className="border border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-foreground">Create Event</CardTitle>
                <p className="text-xs text-muted-foreground">Add a mission to the rotation calendar.</p>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleCreateEvent}>
                  <div className="space-y-1">
                    <Label htmlFor="eventTitle">Title</Label>
                    <Input
                      id="eventTitle"
                      value={newEventForm.title}
                      onChange={(event) => handleNewEventChange('title', event.target.value)}
                      placeholder="e.g. Logistics Rehearsal"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="eventStart">Start date</Label>
                      <Input
                        id="eventStart"
                        type="date"
                        value={newEventForm.date}
                        onChange={(event) => handleNewEventChange('date', event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="eventEnd">End date (optional)</Label>
                      <Input
                        id="eventEnd"
                        type="date"
                        value={newEventForm.endDate}
                        min={newEventForm.date}
                        onChange={(event) => handleNewEventChange('endDate', event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="eventCategory">Category</Label>
                      <Input
                        id="eventCategory"
                        value={newEventForm.category}
                        onChange={(event) => handleNewEventChange('category', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="eventTime">Time</Label>
                      <Input
                        id="eventTime"
                        value={newEventForm.time}
                        placeholder="e.g. 0800-1700"
                        onChange={(event) => handleNewEventChange('time', event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="eventNotes">Notes</Label>
                    <Textarea
                      id="eventNotes"
                      value={newEventForm.notes}
                      onChange={(event) => handleNewEventChange('notes', event.target.value)}
                      rows={3}
                    />
                  </div>
                  {eventFormMessage && (
                    <div
                      className={`rounded-md px-3 py-2 text-sm ${
                        eventFormMessage.type === 'success'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {eventFormMessage.text}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={creatingEvent}>
                    {creatingEvent ? 'Saving...' : 'Add Event'}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <ResourceWatch events={events} />
          </div>
        </div>
      </div>
      {isRestricted && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center bg-background/80 px-6 pt-24 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Work in Progress</p>
          <h2 className="mt-3 text-3xl font-semibold text-foreground">Forecast of Events coming soon</h2>
        </div>
      )}
    </div>
  );
}

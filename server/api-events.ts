import { Request, Response } from "express";

export interface Event {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  category?: string;
  time?: string;
  notes?: string;
  resources?: { name: string; status: 'pending' | 'confirmed' }[];
  assignees?: string[];
  tags?: string[];
}

// In-memory storage for events
let events: Event[] = [];

// Initialize with some sample data if empty
if (events.length === 0) {
  events = [
    {
      id: '1',
      title: 'IPPT Test Session',
      date: new Date(),
      category: 'Training',
      time: '07:00 - 12:00',
      notes: 'Annual fitness test for Company A',
      resources: [
        { name: 'Timing equipment', status: 'confirmed' },
        { name: 'Medical support', status: 'pending' }
      ],
      assignees: ['SGT Tan', 'CPL Lee'],
      tags: ['mandatory', 'fitness']
    },
    {
      id: '2',
      title: 'Annual Training Camp',
      date: new Date('2026-01-04'),
      endDate: new Date('2026-01-08'),
      category: 'Training',
      time: 'Full Day',
      notes: 'Week-long comprehensive training exercise',
      assignees: ['All Personnel'],
      tags: ['multiday', 'mandatory', 'training']
    },
    {
      id: '3',
      title: 'Route March',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      category: 'Training',
      time: '06:00 - 09:00',
      assignees: ['Platoon 1', 'Platoon 2']
    }
  ];
}

export function getEvents(req: Request, res: Response) {
  try {
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
}

export function createEvent(req: Request, res: Response) {
  try {
    const eventData = req.body;
    const newEvent: Event = {
      id: Date.now().toString(),
      title: eventData.title,
      date: new Date(eventData.date),
      endDate: eventData.endDate ? new Date(eventData.endDate) : undefined,
      category: eventData.category,
      time: eventData.time,
      notes: eventData.notes,
      resources: eventData.resources || [],
      assignees: eventData.assignees || [],
      tags: eventData.tags || []
    };
    
    events.push(newEvent);
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ error: "Failed to create event" });
  }
}

export function updateEvent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const eventData = req.body;
    
    const eventIndex = events.findIndex(e => e.id === id);
    if (eventIndex === -1) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    events[eventIndex] = {
      ...events[eventIndex],
      ...eventData,
      date: new Date(eventData.date),
      endDate: eventData.endDate ? new Date(eventData.endDate) : undefined
    };
    
    res.json(events[eventIndex]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update event" });
  }
}

export function deleteEvent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const eventIndex = events.findIndex(e => e.id === id);
    if (eventIndex === -1) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    events.splice(eventIndex, 1);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete event" });
  }
}

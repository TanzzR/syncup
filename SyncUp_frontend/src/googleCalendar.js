/**
 * Google Calendar API utilities for SyncUp.
 * Uses the Google Calendar REST API v3 with an OAuth access token.
 */

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Get the next occurrence of a given weekday from today.
 * @param {'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'} dayName
 * @returns {Date}
 */
export function getNextDateForDay(dayName) {
    const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
    const currentMondayDiff = currentDay === 0 ? -6 : 1 - currentDay;

    // Get this week's Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + currentMondayDiff);

    // Offset from Monday
    const offset = dayMap[dayName] === 0 ? 6 : dayMap[dayName] - 1; // Mon=0 .. Sun=6
    const result = new Date(monday);
    result.setDate(monday.getDate() + offset);
    return result;
}

/**
 * Format a Date + hour into an ISO datetime string.
 * @param {Date} date
 * @param {number} hour (0-23)
 * @returns {string} ISO 8601 datetime
 */
function toISO(date, hour) {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Create a Google Calendar event for a schedule slot.
 * @param {string} accessToken - Google OAuth access token
 * @param {string} day - Day abbreviation ('Mon', 'Tue', etc.)
 * @param {number} hour - Hour (8-20)
 * @param {string} status - 'free', 'busy', or 'skip'
 * @returns {Promise<object>} The created event
 */
export async function createCalendarEvent(accessToken, day, hour, status) {
    const date = getNextDateForDay(day);
    const statusLabels = {
        free: '✅ SyncUp — Free',
        busy: '🚫 SyncUp — Busy',
        skip: '⚠️ SyncUp — Can Skip',
    };

    const event = {
        summary: statusLabels[status] || `SyncUp — ${status}`,
        description: `Schedule slot set via SyncUp app.\nStatus: ${status}\nDay: ${day}, Hour: ${hour}:00`,
        start: {
            dateTime: toISO(date, hour),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
            dateTime: toISO(date, hour + 1),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        colorId: status === 'free' ? '10' : status === 'busy' ? '11' : '5',
    };

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to create calendar event');
    }

    return res.json();
}

/**
 * Delete a Google Calendar event by its ID.
 * @param {string} accessToken
 * @param {string} eventId
 */
export async function deleteCalendarEvent(accessToken, eventId) {
    const res = await fetch(
        `${CALENDAR_API}/calendars/primary/events/${eventId}`,
        {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    );

    if (!res.ok && res.status !== 404) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to delete calendar event');
    }
}

/**
 * Batch-create calendar events for an entire schedule object.
 * @param {string} accessToken
 * @param {Object} schedule - e.g. { 'Mon-9': 'free', 'Tue-14': 'busy' }
 * @returns {Promise<Object>} Map of slot key → event ID
 */
export async function syncScheduleToCalendar(accessToken, schedule) {
    const eventIds = {};

    for (const [key, status] of Object.entries(schedule)) {
        if (!status) continue;
        const [day, hourStr] = key.split('-');
        const hour = parseInt(hourStr, 10);

        try {
            const event = await createCalendarEvent(accessToken, day, hour, status);
            eventIds[key] = event.id;
        } catch (err) {
            console.error(`Failed to sync ${key}:`, err.message);
        }
    }

    return eventIds;
}

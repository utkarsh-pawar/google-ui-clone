// Posting schedule stored in localStorage
// User picks up to 3 daily IST times → converted to UTC for YouTube publishAt

const SCHEDULE_KEY = 'yt_posting_schedule';
const IST_OFFSET   = 5.5 * 60; // IST = UTC+5:30 in minutes

// Default slots: 8am, 1pm, 6pm IST — peak Indian YouTube hours
const DEFAULT_SLOTS = ['08:00', '13:00', '18:00'];

export function loadSchedule() {
  if (typeof window === 'undefined') return DEFAULT_SLOTS;
  try {
    const s = JSON.parse(localStorage.getItem(SCHEDULE_KEY));
    return Array.isArray(s) && s.length ? s : DEFAULT_SLOTS;
  } catch { return DEFAULT_SLOTS; }
}

export function saveSchedule(slots) {
  try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(slots)); } catch {}
}

// Convert "HH:MM" IST string → UTC Date object for today (or tomorrow if past)
function istTimeToDate(istTimeStr) {
  const [h, m] = istTimeStr.split(':').map(Number);
  const istMinutes = h * 60 + m;
  const utcMinutes = istMinutes - IST_OFFSET;

  const now   = new Date();
  const today  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const slotMs = utcMinutes * 60 * 1000;
  let slotDate = new Date(today.getTime() + slotMs);

  // If already past, use tomorrow
  if (slotDate <= now) slotDate.setUTCDate(slotDate.getUTCDate() + 1);
  return slotDate;
}

// Returns the next upcoming slot as a Date (for publishAt)
export function getNextPublishTime() {
  const slots  = loadSchedule().sort();
  const now    = new Date();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const IST_OFFSET_H = IST_OFFSET;

  for (const slot of slots) {
    const [h, m]  = slot.split(':').map(Number);
    const utcMin  = h * 60 + m - IST_OFFSET_H;
    if (utcMin > nowMin) {
      const d = new Date(now);
      d.setUTCHours(Math.floor(utcMin / 60), utcMin % 60, 0, 0);
      return d;
    }
  }
  // All slots past — next is tomorrow's first slot
  return istTimeToDate(slots[0]);
}

// Human-readable: "Today at 6:00 PM IST" or "Tomorrow at 8:00 AM IST"
export function formatPublishTime(date) {
  const now     = new Date();
  const istDate = new Date(date.getTime() + IST_OFFSET * 60 * 1000);
  const isToday = istDate.getUTCDate() === new Date(now.getTime() + IST_OFFSET * 60 * 1000).getUTCDate();
  const h       = istDate.getUTCHours();
  const m       = istDate.getUTCMinutes();
  const ampm    = h >= 12 ? 'PM' : 'AM';
  const h12     = h % 12 || 12;
  const mStr    = m ? `:${String(m).padStart(2, '0')}` : '';
  return `${isToday ? 'Today' : 'Tomorrow'} at ${h12}${mStr} ${ampm} IST`;
}

// All available IST time options for the picker (every 30 min, 5am–11pm)
export const TIME_OPTIONS = Array.from({ length: 37 }, (_, i) => {
  const totalMin = 5 * 60 + i * 30;
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

export function formatIST(slot) {
  const [h, m] = slot.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  const mStr = m ? `:${String(m).padStart(2, '0')}` : '';
  return `${h12}${mStr} ${ampm}`;
}

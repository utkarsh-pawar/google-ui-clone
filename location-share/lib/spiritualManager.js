// Spiritual Channel Manager — defines the autonomous content strategy
// Claude/Groq uses this as its creative brief for daily video decisions

export const SPIRITUAL_CHANNEL_PERSONA = `You are the creative director of a viral Hindi spiritual YouTube Shorts channel focused on Indian gods, ancient wisdom, and devotional content.

YOUR CHANNEL IDENTITY:
- Language: Hindi (Devanagari) for narration. Sanskrit for shlokas. English for image prompts only.
- Voice: Calm, moving, like a wise elder speaking to a beloved child
- Goal: Make the viewer feel peace, awe, or hope within 45 seconds
- Style: Each video about ONE specific deity or ONE teaching — never mixed

YOUR CONTENT PILLARS (rotate through these):
1. SHLOKA REVEAL — A Gita/Veda/Upanishad verse explained in simple Hindi. Why it matters today.
2. DEITY STORY — One miraculous or emotional episode from a god's life. Visual storytelling.
3. MORNING PRAYER — The meaning behind a chant (Hanuman Chalisa line, Gayatri Mantra, etc.)
4. CHANAKYA WISDOM — Ancient practical truth, still shockingly relevant.
5. FESTIVAL SPECIAL — Content tied to the upcoming Hindu festival (within 3 days).

DEITY ROTATION SCHEDULE (weekly rhythm — do not deviate):
- Monday: Shiva / Mahadev
- Tuesday: Hanuman
- Wednesday: Ganesha / Ganpati
- Thursday: Vishnu / Krishna
- Friday: Lakshmi / Durga / Devi
- Saturday: Hanuman (second day — biggest devotional day)
- Sunday: Ram / Ramayan

STRICT SCRIPTURE ACCURACY:
- Bhagavad Gita → Krishna speaks to Arjuna. Ram has NO role in Gita.
- Ramayan → Ram, Sita, Hanuman, Lakshmana. Krishna does NOT appear.
- Hanuman Chalisa → Hanuman's devotion to Ram. Not a Gita text.
- Mahabharata → Pandavas, Kauravas, Krishna as guide.
- NEVER mix characters between scriptures.

AVOID repeating topics from the recent history list provided.`;

// Hindu festival calendar (month 0-indexed, approximate dates)
// Used to create festival-timed content 1-2 days before
export const HINDU_FESTIVALS = [
  { name: 'Makar Sankranti', month: 0, day: 14, deity: 'Surya', angle: 'festival' },
  { name: 'Vasant Panchami', month: 1, day: 14, deity: 'Saraswati', angle: 'festival' },
  { name: 'Maha Shivratri', month: 1, day: 26, deity: 'Shiva', angle: 'festival' },
  { name: 'Holi', month: 2, day: 25, deity: 'Krishna', angle: 'festival' },
  { name: 'Ram Navami', month: 3, day: 6, deity: 'Ram', angle: 'festival' },
  { name: 'Hanuman Jayanti', month: 3, day: 15, deity: 'Hanuman', angle: 'festival' },
  { name: 'Akshaya Tritiya', month: 4, day: 10, deity: 'Lakshmi', angle: 'festival' },
  { name: 'Rath Yatra', month: 6, day: 7, deity: 'Jagannath', angle: 'festival' },
  { name: 'Nag Panchami', month: 7, day: 9, deity: 'Shiva', angle: 'festival' },
  { name: 'Raksha Bandhan', month: 7, day: 19, deity: 'Vishnu', angle: 'festival' },
  { name: 'Janmashtami', month: 7, day: 26, deity: 'Krishna', angle: 'festival' },
  { name: 'Ganesh Chaturthi', month: 8, day: 7, deity: 'Ganesha', angle: 'festival' },
  { name: 'Navratri', month: 9, day: 3, deity: 'Durga', angle: 'festival' },
  { name: 'Dussehra', month: 9, day: 12, deity: 'Ram', angle: 'festival' },
  { name: 'Karwa Chauth', month: 9, day: 20, deity: 'Shiva', angle: 'festival' },
  { name: 'Dhanteras', month: 9, day: 29, deity: 'Lakshmi', angle: 'festival' },
  { name: 'Diwali', month: 9, day: 31, deity: 'Lakshmi', angle: 'festival' },
  { name: 'Dev Deepawali', month: 10, day: 15, deity: 'Shiva', angle: 'festival' },
  { name: 'Tulsi Vivah', month: 10, day: 12, deity: 'Vishnu', angle: 'festival' },
  { name: 'Vivah Panchami', month: 11, day: 6, deity: 'Ram', angle: 'festival' },
];

// Weekly deity schedule — key is day of week (0=Sun, 1=Mon...)
export const WEEKLY_DEITY = {
  0: { deity: 'Ram',     focus: 'Ramayan teachings and Ram\'s noble qualities' },
  1: { deity: 'Shiva',   focus: 'Mahadev\'s grace, Shiva\'s power and compassion' },
  2: { deity: 'Hanuman', focus: 'Hanuman\'s devotion, strength, and service' },
  3: { deity: 'Ganesha', focus: 'Ganpati\'s wisdom, removing obstacles, new beginnings' },
  4: { deity: 'Krishna', focus: 'Krishna\'s teachings, Gita wisdom, divine leelas' },
  5: { deity: 'Lakshmi', focus: 'Devi\'s blessings, Durga\'s power, feminine divine' },
  6: { deity: 'Hanuman', focus: 'Saturday Hanuman — most powerful devotional day' },
};

// Content angle options — AI picks the most fitting one for the deity + day
export const CONTENT_ANGLES = [
  { id: 'shloka',    label: 'Shloka/Verse Meaning',   prompt: 'Pick one specific shloka or verse associated with this deity. Reveal its meaning in simple Hindi. Show why it answers a modern problem.' },
  { id: 'story',     label: 'Divine Story Episode',    prompt: 'Pick one specific emotional or miraculous episode from this deity\'s life. Tell it visually in 10 scenes.' },
  { id: 'prayer',    label: 'Prayer/Mantra Power',     prompt: 'Explain the meaning and power of one specific prayer or mantra of this deity. Why do millions chant it?' },
  { id: 'teaching',  label: 'Life Teaching',           prompt: 'What is the most important life lesson this deity teaches? Connect it to a problem modern Indians face today.' },
  { id: 'festival',  label: 'Festival Special',        prompt: 'Create content specifically for the upcoming festival. Why do we celebrate it? What does it mean spiritually?' },
];

export function getUpcomingFestival() {
  const now = new Date();
  const upcoming = HINDU_FESTIVALS.find(f => {
    const fDate = new Date(now.getFullYear(), f.month, f.day);
    const diff = (fDate - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  });
  return upcoming || null;
}

export function getTodayDeity() {
  const day = new Date().getDay();
  return WEEKLY_DEITY[day];
}

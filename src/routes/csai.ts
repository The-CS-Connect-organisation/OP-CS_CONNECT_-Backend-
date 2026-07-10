import { Router, Request, Response } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

const CEREBRAS_API_KEY = () => process.env.CEREBRAS_API_KEY || process.env.VITE_CEREBRAS_API_KEY || '';

const CBSE_PERIODS = ['08:20', '09:00', '09:40', '10:30', '11:10', '11:50', '13:00', '13:40', '14:20'];
const CBSE_PERIOD_DURATION = 40;
const CBSE_BREAKS = [{ start: '10:20', end: '10:30', name: 'Snacks' }, { start: '12:30', end: '13:00', name: 'Lunch' }];
const CBSE_DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


function buildClassContext(className: string, tt: any[]): string {
  if (!tt || tt.length === 0) return `${className}: (no timetable yet)`;
  return tt.map((d: any) => {
    const periods = (d.periods || []).map((p: any) =>
      `  ${p.time || ''} | Period ${p.period || ''} | ${p.subject || '—'} | ${p.teacher || '—'}`
    ).join('\n');
    return `${d.day}:\n${periods}`;
  }).join('\n');
}

router.post('/timetable', async (req: Request, res: Response) => {
  try {
    const key = CEREBRAS_API_KEY();
    if (!key) return res.status(500).json({ error: 'Cerebras API key not configured' });

    const { message, className, allClassesTimetables, subjects, teachers, bellSchedule } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const allTt = allClassesTimetables || {};
    const classesStr = Object.keys(allTt).length
      ? Object.entries(allTt).map(([cls, tt]) => buildClassContext(cls, tt as any[])).join('\n\n')
      : '(no timetable data provided)';

    const subjectsStr = Array.isArray(subjects) && subjects.length
      ? subjects.map((s: any) => `${s.name}${s.code ? ` (${s.code})` : ''}`).join(', ')
      : '(none provided)';

    const teachersStr = Array.isArray(teachers) && teachers.length
      ? teachers.map((t: any) => `${t.name}${t.subjects ? ` — ${t.subjects.join(', ')}` : ''}`).join('\n')
      : '(none provided)';

    const bs = bellSchedule || {};
    const bellStr = Object.keys(bs).length
      ? `Start: ${bs.startTime || '08:20'}, End: ${bs.endTime || '15:00'}, Duration: ${bs.periodDuration || 40}min, Periods: ${bs.periods || 8}`
      : 'Start: 08:20, End: 15:00, Duration: 40min, Periods: 8';

    const systemPrompt = `You are CSAI, an AI timetable management agent for CBSE schools. You respond ONLY with valid JSON.

SCHOOL TIMETABLE CONFIGURATION:
- Standard CBSE day: 8:20 AM to 3:00 PM
- Period duration: ${CBSE_PERIOD_DURATION} minutes
- Number of periods per day: 8
- Available time slots: ${CBSE_PERIODS.join(', ')}
- Breaks: ${CBSE_BREAKS.map(b => `${b.start}-${b.end} (${b.name})`).join(', ')}
- Available days: ${CBSE_DAYS_LIST.join(', ')}

CURRENT BELL SCHEDULE:
${bellStr}

AVAILABLE SUBJECTS:
${subjectsStr}

AVAILABLE TEACHERS:
${teachersStr}

CURRENT TIMETABLES:
${classesStr}

USER REQUEST: ${message}

You MUST respond with a JSON object containing:
1. "response": A clear natural language explanation of what you'll do
2. "operations": An array of operations to execute. Each operation object can be one of:

For SETTING a full class timetable (replaces entire timetable for a class):
{ "type": "setTimetable", "className": "10-A", "timetable": [ { "day": "Monday", "periods": [ { "period": 1, "time": "08:20", "subject": "Math", "teacher": "Teacher Name" }, ... ] }, ... ] }

For ADDING a new entry to an existing timetable (you can also use this to create a timetable for an empty class):
{ "type": "addEntry", "data": { "class": "10-A", "day": "Monday", "time": "08:20", "subject": "Math", "teacher": "Teacher Name", "teacherId": "", "subjectId": "", "room": "", "period": 1 } }

For UPDATING an entry:
{ "type": "updateEntry", "id": "existing-entry-id", "data": { ... fields to update ... } }

For DELETING an entry:
{ "type": "deleteEntry", "id": "entry-id" }

For UPDATING the bell schedule:
{ "type": "updateBellSchedule", "data": { "startTime": "08:20", "endTime": "15:00", "periodDuration": 40, "periods": 8, "breakStart": "10:20", "breakDuration": 10, "lunchStart": "12:30", "lunchDuration": 30 } }

IMPORTANT RULES:
- Only use setTimetable to replace an entire class's timetable. Use addEntry for adding individual slots.
- When creating new timetables for multiple classes, analyze available subjects and teachers and distribute them intelligently.
- For Saturday timetables, you can use fewer periods (e.g., 5-6 periods).
- When user asks to merge subjects (like "club History and Civics together"), combine their periods into a single longer period.
- IMPORTANT: Time must be a single point like "08:20", NOT a range like "08:20-09:00". Use one of these exact times: ${CBSE_PERIODS.join(', ')}.
- Make sure teacher assignments don't overlap.
- Be creative but practical with subject distribution.
- Return ONLY a JSON object, no markdown formatting.`;

    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-4-scout-17b-16e-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User request: ${message}\n\nReturn only the JSON.` },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const data: any = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!response.ok || !text) throw new Error(data?.error?.message || 'Cerebras returned no response');

    let parsed;
    try {
      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/gm, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('Failed to parse AI response as JSON');
    }

    const results: any[] = [];
    const ops = parsed.operations || [];

    for (const op of ops) {
      try {
        switch (op.type) {
          case 'setTimetable': {
            await setData(`timetable/${op.className}`, op.timetable);
            results.push({ type: 'setTimetable', className: op.className, status: 'done' });
            break;
          }
          case 'addEntry': {
            const className = op.data?.class || op.className || '';
            if (!className) {
              results.push({ type: 'addEntry', status: 'error', error: 'Missing class name in data' });
              break;
            }
            const entryId = id('tt');
            const entry = { id: entryId, ...op.data, createdAt: new Date().toISOString() };
            // Fetch existing timetable for this class and append
            const raw = await getData(`timetable/${className}`);
            const entries = Array.isArray(raw) ? raw : [];
            entries.push(entry);
            await setData(`timetable/${className}`, entries);
            results.push({ type: 'addEntry', id: entryId, className, status: 'done' });
            break;
          }
          case 'updateEntry': {
            // Scan all class timetables to find entry by id
            const allTt = await getData('timetable');
            let found = false;
            if (allTt && typeof allTt === 'object') {
              for (const [key, classEntries] of Object.entries(allTt)) {
                if (Array.isArray(classEntries)) {
                  const idx = classEntries.findIndex((e: any) => e.id === op.id);
                  if (idx !== -1) {
                    classEntries[idx] = { ...classEntries[idx], ...op.data, updatedAt: new Date().toISOString() };
                    await setData(`timetable/${key}`, classEntries);
                    found = true;
                    results.push({ type: 'updateEntry', id: op.id, className: key, status: 'done' });
                    break;
                  }
                }
              }
            }
            if (!found) results.push({ type: 'updateEntry', id: op.id, status: 'error', error: 'Entry not found' });
            break;
          }
          case 'deleteEntry': {
            // Scan all class timetables to find entry by id
            const allTt2 = await getData('timetable');
            let found2 = false;
            if (allTt2 && typeof allTt2 === 'object') {
              for (const [key, classEntries] of Object.entries(allTt2)) {
                if (Array.isArray(classEntries)) {
                  const idx = classEntries.findIndex((e: any) => e.id === op.id);
                  if (idx !== -1) {
                    classEntries.splice(idx, 1);
                    await setData(`timetable/${key}`, classEntries);
                    found2 = true;
                    results.push({ type: 'deleteEntry', id: op.id, className: key, status: 'done' });
                    break;
                  }
                }
              }
            }
            if (!found2) results.push({ type: 'deleteEntry', id: op.id, status: 'error', error: 'Entry not found' });
            break;
          }
          case 'updateBellSchedule': {
            const schedules = await listData('bellSchedules');
            if (schedules.length > 0) {
              const updated = { ...schedules[0], ...op.data, updatedAt: new Date().toISOString() };
              await setData(`bellSchedules/${schedules[0].id}`, updated);
            } else {
              const bsId = id('bs');
              await setData(`bellSchedules/${bsId}`, { id: bsId, name: 'Regular Day', ...op.data });
            }
            results.push({ type: 'updateBellSchedule', status: 'done' });
            break;
          }
          default:
            results.push({ type: op.type, status: 'unknown-operation' });
        }
      } catch (opErr: any) {
        results.push({ type: op.type, status: 'error', error: opErr.message });
      }
    }

    res.json({ response: parsed.response || 'Done.', operations: results });

  } catch (error: any) {
    console.error('[CSAI] Error:', error);
    res.status(500).json({ error: error?.message || 'CSAI processing failed' });
  }
});

export default router;

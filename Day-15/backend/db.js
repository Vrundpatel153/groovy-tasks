import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

async function readDb() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { meetings: [] };
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getMeetings() {
  const db = await readDb();
  return db.meetings || [];
}

export async function saveMeeting(meeting) {
  const db = await readDb();
  if (!db.meetings) db.meetings = [];
  
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const newMeeting = {
    id,
    timestamp: new Date().toISOString(),
    ...meeting
  };
  
  db.meetings.push(newMeeting);
  await writeDb(db);
  return newMeeting;
}

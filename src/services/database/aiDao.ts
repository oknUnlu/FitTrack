import { getDatabase } from './database';

export interface AIConversation {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  source: 'gemini_cloud' | 'gemini_nano' | 'fallback';
  createdAt: number;
}

function rowToConversation(row: any): AIConversation {
  return {
    id: row.id, userId: row.user_id, role: row.role,
    content: row.content, source: row.source, createdAt: row.created_at,
  };
}

export async function getConversations(userId: string, limit = 50): Promise<AIConversation[]> {
  const db = await getDatabase();
  // Take the most RECENT `limit` messages (inner DESC), then return them in
  // chronological order for display. Ordering ASC directly would keep the
  // OLDEST 50 forever, so once a chat passes the limit the user's recent
  // history would vanish on reload and Gemini would get stale context.
  const rows = await db.getAllAsync(
    `SELECT * FROM (
       SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
     ) ORDER BY created_at ASC`,
    [userId, limit]
  );
  return rows.map(rowToConversation);
}

export async function getRequestCountSince(userId: string, sinceTimestamp: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM ai_conversations WHERE user_id = ? AND role = 'user' AND created_at >= ?",
    [userId, sinceTimestamp]
  );
  return row?.count ?? 0;
}

export async function insertConversation(conv: AIConversation): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO ai_conversations (id, user_id, role, content, source, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [conv.id, conv.userId, conv.role, conv.content, conv.source, conv.createdAt]
  );
}

export async function deleteAllConversations(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ai_conversations WHERE user_id = ?', [userId]);
}

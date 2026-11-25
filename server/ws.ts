import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import { verifySessionToken } from './auth';
import { db } from './db';

interface ClientSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clientsByUser = new Map<string, Set<ClientSocket>>();

export function sendToUser(userId: string, event: string, payload: unknown) {
  const sockets = clientsByUser.get(userId);
  if (!sockets) return;
  const serialized = JSON.stringify({ event, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

export function broadcastToAll(event: string, payload: unknown) {
  const serialized = JSON.stringify({ event, payload });
  for (const sockets of clientsByUser.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
}

export function isUserConnected(userId: string): boolean {
  const set = clientsByUser.get(userId);
  return Boolean(set && set.size > 0);
}

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws: ClientSocket, req) => {
    ws.isAlive = true;

    const url = new URL(req.url || '/ws', 'http://localhost');
    let token = url.searchParams.get('token');

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.split(';').find((c) => c.trim().startsWith('orbis_session='));
      if (match) {
        token = decodeURIComponent(match.trim().split('=').slice(1).join('='));
      }
    }

    if (!token) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const userId = await verifySessionToken(token);
    if (!userId) {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.userId = userId;
    if (!clientsByUser.has(userId)) {
      clientsByUser.set(userId, new Set());
    }
    clientsByUser.get(userId)!.add(ws);

    db.prepare(`UPDATE users SET is_online = 1, last_seen_at = datetime('now') WHERE id = ?`).run(userId);
    broadcastToAll('presence:update', { userId, isOnline: true });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'typing:start' || msg.event === 'typing:stop') {
          const conversationId = String(msg.payload?.conversationId || '');
          if (!conversationId) return;
          const member = db
            .prepare(`SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`)
            .get(conversationId, userId);
          if (!member) return;

          const participants = db
            .prepare(`SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?`)
            .all(conversationId, userId) as { user_id: string }[];

          for (const p of participants) {
            sendToUser(p.user_id, msg.event, { conversationId, userId });
          }
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      const set = clientsByUser.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          clientsByUser.delete(userId);
          db.prepare(`UPDATE users SET is_online = 0, last_seen_at = datetime('now') WHERE id = ?`).run(userId);
          broadcastToAll('presence:update', { userId, isOnline: false });
        }
      }
    });
  });

  const interval = setInterval(() => {
    for (const ws of wss.clients as Set<ClientSocket>) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));
  return wss;
}

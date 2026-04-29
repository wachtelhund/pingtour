import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import crypto from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  addPlayer,
  clearResult,
  createLobby,
  recordResult,
  removePlayer,
  startTournament,
} from '../../../src/bracket';
import type {
  ApiRequest,
  MutationResponse,
  StateResponse,
} from '../../../src/protocol';
import type { Tournament } from '../../../src/types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.STATE_TABLE_NAME!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'pingpong123';
const COOKIE_SECRET =
  process.env.COOKIE_SECRET ?? `${ADMIN_PASSWORD}.session.v1`;
const PK = 'tournament';

interface StoredState {
  tournament: Tournament | null;
  version: number;
}

async function loadState(): Promise<StoredState> {
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: PK } }));
  if (!r.Item) return { tournament: null, version: 0 };
  return {
    tournament: (r.Item.tournament ?? null) as Tournament | null,
    version: typeof r.Item.version === 'number' ? r.Item.version : 0,
  };
}

async function saveState(s: StoredState): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: { pk: PK, tournament: s.tournament, version: s.version },
    }),
  );
}

function signSession(): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const data = String(exp);
  const sig = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(data)
    .digest('hex');
  return `${data}.${sig}`;
}

function verifySession(cookie: string): boolean {
  const [data, sig] = cookie.split('.');
  if (!data || !sig) return false;
  const expected = crypto
    .createHmac('sha256', COOKIE_SECRET)
    .update(data)
    .digest('hex');
  if (sig !== expected) return false;
  return Number(data) > Date.now();
}

function isAdmin(event: APIGatewayProxyEventV2): boolean {
  const cookie = event.headers?.cookie ?? event.headers?.Cookie ?? '';
  const m = cookie.match(/(?:^|;\s*)pingtour_admin=([^;]+)/);
  return m ? verifySession(m[1]) : false;
}

function pickOrigin(event: APIGatewayProxyEventV2): string {
  return (
    event.headers?.origin ??
    event.headers?.Origin ??
    '*'
  );
}

function corsHeaders(event: APIGatewayProxyEventV2): Record<string, string> {
  return {
    'access-control-allow-origin': pickOrigin(event),
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

function resp<T>(
  event: APIGatewayProxyEventV2,
  status: number,
  body: T,
  extraHeaders: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...corsHeaders(event),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(event), body: '' };
  }
  if (path.endsWith('/healthz')) {
    return resp(event, 200, { ok: true });
  }
  if (path.endsWith('/api/state') && method === 'GET') {
    const s = await loadState();
    return resp<StateResponse>(event, 200, {
      tournament: s.tournament,
      version: s.version,
    });
  }
  if (path.endsWith('/api/mutate') && method === 'POST') {
    const body = JSON.parse(event.body ?? '{}') as ApiRequest;
    return handleMutation(event, body);
  }
  return resp(event, 404, { ok: false, error: 'Not found' });
};

async function handleMutation(
  event: APIGatewayProxyEventV2,
  msg: ApiRequest,
): Promise<APIGatewayProxyResultV2> {
  if (msg.type === 'auth') {
    if (typeof msg.password === 'string' && msg.password === ADMIN_PASSWORD) {
      const token = signSession();
      const s = await loadState();
      return resp<MutationResponse>(
        event,
        200,
        { ok: true, tournament: s.tournament, version: s.version },
        {
          'set-cookie':
            `pingtour_admin=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`,
        },
      );
    }
    return resp<MutationResponse>(event, 400, { ok: false, authFail: true });
  }

  if (msg.type === 'join') {
    try {
      const s = await loadState();
      if (!s.tournament || s.tournament.status !== 'lobby') {
        throw new Error('No lobby is open');
      }
      const before = s.tournament.players.length;
      const next = addPlayer(s.tournament, msg.name);
      const newPlayer = next.players[before];
      const newState: StoredState = {
        tournament: next,
        version: s.version + 1,
      };
      await saveState(newState);
      return resp<MutationResponse>(event, 200, {
        ok: true,
        tournament: newState.tournament,
        version: newState.version,
        playerId: newPlayer.id,
      });
    } catch (e) {
      return resp<MutationResponse>(event, 400, {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!isAdmin(event)) {
    return resp<MutationResponse>(event, 401, {
      ok: false,
      error: 'Not authenticated',
    });
  }

  try {
    const s = await loadState();
    let next: Tournament | null = s.tournament;
    if (msg.type === 'create-lobby') {
      next = createLobby(msg.name);
    } else if (msg.type === 'remove-player') {
      if (!next) throw new Error('No tournament running');
      next = removePlayer(next, msg.playerId);
    } else if (msg.type === 'start') {
      if (!next) throw new Error('No lobby to start');
      next = startTournament(next, { shuffleSeeds: msg.shuffleSeeds });
    } else if (msg.type === 'record') {
      if (!next) throw new Error('No tournament running');
      next = recordResult(next, {
        matchId: msg.matchId,
        winnerSide: msg.winnerSide,
        score: msg.score,
      });
    } else if (msg.type === 'clear') {
      if (!next) throw new Error('No tournament running');
      next = clearResult(next, msg.matchId);
    } else if (msg.type === 'reset') {
      next = null;
    }
    const newState: StoredState = { tournament: next, version: s.version + 1 };
    await saveState(newState);
    return resp<MutationResponse>(event, 200, {
      ok: true,
      tournament: newState.tournament,
      version: newState.version,
    });
  } catch (e) {
    return resp<MutationResponse>(event, 400, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

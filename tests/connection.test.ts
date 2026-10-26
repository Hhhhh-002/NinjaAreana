// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameConnection } from '../src/net/GameConnection';
import { CMD } from '../src/generated/commands';
import { decode, encode } from '../src/net/protocol';

class FakeWebSocket {
  static OPEN = 1;
  static latest: FakeWebSocket;
  readyState = 0; bufferedAmount = 0; binaryType = '';
  onopen = () => {}; onmessage = (_event: any) => {}; onerror = () => {}; onclose = () => {};
  sent: Uint8Array[] = [];
  constructor(_url: URL) { FakeWebSocket.latest = this; }
  send(bytes: Uint8Array) { this.sent.push(bytes); }
  close() { this.readyState = 3; this.onclose(); }
  open() { this.readyState = 1; this.onopen(); }
  respond(cmd: number, requestId: string, body: Uint8Array, code = 0, message = '') {
    const bytes = encode('ServerEnvelope', { cmd, requestId, body, code, message });
    this.onmessage({ data: Uint8Array.from(bytes).buffer });
  }
}
describe('socket response routing', () => {
  afterEach(() => { FakeWebSocket.latest?.close(); vi.unstubAllGlobals(); });
  it('correlates responses, routes pushes and never resends gameplay on connection loss', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const connection = new GameConnection();
    const connected = connection.connect('ws://127.0.0.1:9001/ws');
    const socket = FakeWebSocket.latest; socket.open(); await connected;
    // Initial heartbeat is a gateway-local request and must not become a battle input.
    const heartbeat = decode<any>('ClientEnvelope', socket.sent[0]);
    expect(heartbeat.cmd).toBe(CMD.HEARTBEAT);
    socket.respond(CMD.HEARTBEAT, heartbeat.requestId, encode('HeartbeatResponse', { serverTimeMs: String(Date.now()) }));
    const promise = connection.request(CMD.CAST_SKILL, { skillId: 1001 });
    const cast = decode<any>('ClientEnvelope', socket.sent.at(-1)!);
    socket.respond(CMD.CAST_SKILL, cast.requestId, encode('CastSkillResponse', { castId: '18446744073709551600', skillId: 1001, serverTick: '5' }));
    await expect(promise).resolves.toMatchObject({ castId: '18446744073709551600', skillId: 1001 });
    const push = vi.fn(); connection.onPush = push;
    socket.respond(CMD.PLAYER_LEFT, '0', encode('PlayerLeftEvent', { userId: 'other' }));
    expect(push).toHaveBeenCalledWith(CMD.PLAYER_LEFT, expect.objectContaining({ userId: 'other' }));
    const pending = connection.request(CMD.JUMP); const count = socket.sent.length;
    const rejection = expect(pending).rejects.toMatchObject({ uncertain: true });
    connection.close(); await rejection;
    expect(socket.sent).toHaveLength(count);
  });
});

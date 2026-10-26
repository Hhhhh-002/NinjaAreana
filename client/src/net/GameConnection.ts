import { CMD } from '../generated/commands';
import { decode, encode, requestBodies, responseBodies, type Envelope } from './protocol';

export class RequestError extends Error {
  constructor(message: string, public readonly code = 0, public readonly uncertain = false) { super(message); }
}
interface Pending {
  cmd: number; resolve: (data: any) => void; reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}
/** One socket per session. No silent re-login or replay of gameplay commands after disconnect. */
export class GameConnection {
  private socket?: WebSocket;
  private connecting?: Promise<void>;
  private counter = BigInt(Date.now()) * 1_000_000n + BigInt(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000);
  private sequence = 0n;
  private pending = new Map<string, Pending>();
  private heartbeat?: ReturnType<typeof setInterval>;
  private pinging = false;
  public rtt = 0;
  public onPush: (cmd: number, data: any) => void = () => {};
  public onClose: (reason: string) => void = () => {};
  public onError: (message: string) => void = () => {};
  get connected(): boolean { return this.socket?.readyState === WebSocket.OPEN; }

  connect(url: string): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    if (this.socket) return Promise.reject(new Error('正在关闭上一连接，请稍后重试'));
    let address: URL;
    try { address = new URL(url); } catch { return Promise.reject(new Error('请输入有效网关地址')); }
    if (!['ws:', 'wss:'].includes(address.protocol)) return Promise.reject(new Error('请输入 ws:// 或 wss:// 网关地址'));
    this.connecting = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(address);
      this.socket = socket;
      socket.binaryType = 'arraybuffer';
      const deadline = setTimeout(() => { socket.close(); reject(new Error('连接网关超时')); }, 8000);
      socket.onopen = () => {
        clearTimeout(deadline);
        this.heartbeat = setInterval(() => void this.ping(), 15_000);
        void this.ping();
        resolve();
      };
      socket.onmessage = event => {
        if (socket !== this.socket || !(event.data instanceof ArrayBuffer)) return;
        try { this.receive(new Uint8Array(event.data)); }
        catch { this.onError('收到无法解析的服务端消息，请确认协议版本一致'); }
      };
      socket.onerror = () => { clearTimeout(deadline); socket.close(); reject(new Error('连接失败，请确认网关已启动及地址正确')); };
      socket.onclose = () => {
        clearTimeout(deadline);
        if (socket !== this.socket) return;
        reject(new Error('连接已关闭'));
        clearInterval(this.heartbeat);
        this.socket = undefined;
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timeout);
          pending.reject(new RequestError('连接断开，请重新登录；未收到响应的操作结果尚未确认', 0, true));
        }
        this.pending.clear();
        this.onClose('连接已断开，请重新登录');
      };
    }).finally(() => { this.connecting = undefined; });
    return this.connecting;
  }
  request<T = any>(cmd: number, body: Record<string, unknown> = {}, timeoutMs = 20_000): Promise<T> {
    if (!this.connected) return Promise.reject(new Error('尚未连接服务器'));
    const id = (++this.counter).toString();
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new RequestError('等待响应超时，操作可能已执行，请以服务器状态为准', 0, true));
      }, timeoutMs);
      this.pending.set(id, { cmd, resolve, reject, timeout });
      try { this.transmit(cmd, id, body); }
      catch (error) { clearTimeout(timeout); this.pending.delete(id); reject(error); }
    });
  }
  move(axis: number): void { this.transmit(CMD.SHIFT, (++this.counter).toString(), { directionX: axis, directionY: 0 }); }
  private transmit(cmd: number, requestId: string, body: Record<string, unknown>): void {
    if (!this.connected) throw new Error('服务器连接已断开');
    if (this.socket!.bufferedAmount > 64 * 1024) throw new Error('网络拥塞，请稍后操作');
    const bodyType = requestBodies.get(cmd);
    if (!bodyType) throw new Error('未注册的客户端命令');
    const bytes = encode('ClientEnvelope', { cmd, requestId, clientSequence: (++this.sequence).toString(), body: encode(bodyType, body) });
    this.socket!.send(bytes as Uint8Array<ArrayBuffer>);
  }
  private receive(bytes: Uint8Array): void {
    const envelope = decode<Envelope>('ServerEnvelope', bytes);
    if (envelope.requestId !== '0') {
      const pending = this.pending.get(envelope.requestId);
      if (!pending || pending.cmd !== envelope.cmd) {
        if (envelope.code && envelope.cmd === CMD.SHIFT) this.onError(envelope.message || '移动输入失败');
        return;
      }
      let body: any = {};
      if (!envelope.code) {
        const name = responseBodies.get(envelope.cmd);
        try { body = name ? decode(name, envelope.body) : {}; }
        catch { clearTimeout(pending.timeout); this.pending.delete(envelope.requestId); pending.reject(new Error('响应解析失败，请确认协议版本一致')); return; }
      }
      clearTimeout(pending.timeout);
      this.pending.delete(envelope.requestId);
      if (envelope.code) pending.reject(new RequestError(envelope.message || `请求失败（${envelope.code}）`, envelope.code));
      else {
        pending.resolve(body);
      }
      return;
    }
    if (envelope.code) { this.onError(envelope.message || '操作失败'); return; }
    const name = responseBodies.get(envelope.cmd);
    this.onPush(envelope.cmd, name ? decode(name, envelope.body) : {});
  }
  private async ping(): Promise<void> {
    if (this.pinging || !this.connected) return;
    this.pinging = true;
    const sent = performance.now();
    try { await this.request(CMD.HEARTBEAT, {}, 8000); this.rtt = Math.round(performance.now() - sent); }
    catch { if (this.connected) this.onError('心跳未得到响应，请检查网络'); }
    finally { this.pinging = false; }
  }
  close(): void { this.socket?.close(1000, '用户退出'); }
}

import { WSMessage } from '@shared/types';
type EventHandler = (msg: WSMessage) => void;
export class GameSocket {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: NodeJS.Timeout | null = null;
  private url: string | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private isExplicitDisconnect = false;
  constructor() {
    // Bind methods to ensure 'this' context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.startHeartbeat = this.startHeartbeat.bind(this);
    this.stopHeartbeat = this.stopHeartbeat.bind(this);
    this.reconnect = this.reconnect.bind(this);
  }
  public get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  connect(url: string, userId: string, username: string, onOpen?: () => void) {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connected or connecting');
      return;
    }
    this.url = url;
    this.userId = userId;
    this.username = username;
    this.isExplicitDisconnect = false;
    try {
      console.log(`Connecting to WebSocket: ${url}`);
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        console.log('WebSocket Connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        if (onOpen) onOpen();
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          this.handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };
      this.ws.onclose = (event) => {
        console.log(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'No reason'}`);
        this.stopHeartbeat();
        this.ws = null;
        // Only reconnect if not explicitly disconnected and not a normal closure
        if (!this.isExplicitDisconnect && event.code !== 1000 && event.code !== 1001) {
          this.reconnect();
        }
      };
      this.ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        this.stopHeartbeat();
        // onclose will be called after onerror, handling reconnection there
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      this.reconnect();
    }
  }
  disconnect() {
    this.isExplicitDisconnect = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }
  }
  send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Changed to debug to reduce console noise during reconnection attempts
      console.debug('Cannot send message, WebSocket not open', msg.type);
    }
  }
  on(type: string, callback: EventHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(callback);
  }
  off(type: string, callback: EventHandler) {
    this.listeners.get(type)?.delete(callback);
  }
  private handleMessage(msg: WSMessage) {
    // Handle internal pong
    if (msg.type === 'pong') {
      // Could track latency here if needed
      return;
    }
    // Dispatch to listeners
    const handlers = this.listeners.get(msg.type);
    if (handlers) {
      handlers.forEach(handler => handler(msg));
    }
  }
  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 5000); // 5 seconds ping
  }
  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      // Emit error event to UI
      this.handleMessage({ type: 'error', message: 'Connection lost. Please refresh.' });
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      if (this.url && this.userId && this.username && !this.isExplicitDisconnect) {
        this.connect(this.url, this.userId, this.username);
      }
    }, delay);
  }
}
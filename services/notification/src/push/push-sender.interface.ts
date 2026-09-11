export interface PushMessage {
  token: string;
  templateKey: string;
  payload: Record<string, unknown>;
}

export interface PushSender {
  send(message: PushMessage): Promise<{ delivered: boolean }>;
}

/** NestJS DI token — TypeScript interfaces have no runtime representation. */
export const PUSH_SENDER = Symbol('PUSH_SENDER');

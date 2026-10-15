export type OpKind = 'accept' | 'reject' | 'status';

export interface Op {
  id: string;
  kind: OpKind;
  orderId: string;
  payload?: any;
  createdAt: number;
  attempts: number;
}

export interface QueueStore {
  all(): Promise<Op[]>;
  add(op: Op): Promise<void>;
  remove(id: string): Promise<void>;
  update(op: Op): Promise<void>;
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { IdempotencyStore } from '../../domain/idempotency';

export type ProviderEvent={eventId:string;providerCallId:string;type:'call.initiated'|'call.answered'|'call.completed'|'call.failed';occurredAt:string;metadata:Record<string,unknown>};
export class WebhookSignatureError extends Error { constructor(){super('Webhook signature is invalid.');this.name='WebhookSignatureError'} }
export function verifyWebhook(rawBody:string, signature:string|undefined, secret:string){
  if(!signature) throw new WebhookSignatureError(); const expected=createHmac('sha256',secret).update(rawBody).digest('hex');
  if(expected.length!==signature.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))throw new WebhookSignatureError();
}
export interface EventSink { persist(event:ProviderEvent):Promise<void>; enqueue(event:ProviderEvent):Promise<void> }
/** Persists before enqueuing. Duplicate deliveries never cause another side effect. */
export class TelephonyWebhookService {
  private readonly received=new IdempotencyStore<Promise<{replayed:boolean}>>();
  constructor(private readonly sink:EventSink){}
  process(event:ProviderEvent){return this.received.execute(event.eventId,async()=>{await this.sink.persist(event);await this.sink.enqueue(event);return {replayed:false}}).value}
}

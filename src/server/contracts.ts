/** Stable application ports. Adapters may use Exotel, Airtel IQ, Twilio, Plivo or mocks. */
export interface TelephonyProvider { initiateCall(input:{callId:string;from:string;to:string;webhookUrl:string}):Promise<{providerCallId:string}>; terminateCall(providerCallId:string):Promise<void>; transferCall(input:{providerCallId:string;to:string}):Promise<void> }
export interface AIProvider { classify(input:{text:string;state:string;language:string}):Promise<{intent:string;confidence:number;entities:Record<string,string>}> }
export interface KnowledgeProvider { retrieve(query:string, context:{category?:string;limit:number}):Promise<Array<{chunkId:string;text:string;sourceLabel:string;score:number}>> }
export interface JobQueue { enqueue<T>(name:string,payload:T,options:{idempotencyKey:string;runAt?:Date}):Promise<void> }
export interface LeadRepository { findByPhone(phone:string):Promise<{id:string;status:string}|null>; create(input:{name?:string;phone:string;companyName?:string;source?:string}):Promise<{id:string}>; appendEvent(input:{leadId:string;type:string;actor:string;metadata:Record<string,unknown>}):Promise<void> }

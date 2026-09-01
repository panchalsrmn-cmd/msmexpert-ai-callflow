export type LeadStatus = 'NEW' | 'QUEUED' | 'CALLING' | 'CONTACTED' | 'INTERESTED' | 'QUALIFIED' | 'CALLBACK' | 'TRANSFERRED' | 'NOT_INTERESTED' | 'DO_NOT_CALL' | 'WRONG_NUMBER' | 'FAILED';
export type ConversationState = 'INTRO' | 'CONSENT' | 'QUALIFY_UDYAM' | 'QUALIFY_ZED' | 'DISCOVERY' | 'EXPLAIN_SERVICE' | 'HANDLE_OBJECTION' | 'COLLECT_DETAILS' | 'CALLBACK' | 'TRANSFER' | 'NOT_INTERESTED' | 'DO_NOT_CALL' | 'COMPLETE';
export type IntentType = 'YES' | 'NO' | 'BUSY' | 'CALLBACK_REQUEST' | 'INTERESTED' | 'NOT_INTERESTED' | 'DO_NOT_CALL' | 'ASK_PRICE' | 'ASK_DOCUMENTS' | 'ASK_ELIGIBILITY' | 'ASK_ZED' | 'ASK_SUBSIDY' | 'ALREADY_CERTIFIED' | 'ASK_HUMAN' | 'LANGUAGE_CHANGE' | 'WRONG_NUMBER' | 'UNKNOWN';

export interface CustomerIntent { intent: IntentType; confidence: number; entities: Record<string,string>; sentiment?: 'positive'|'neutral'|'negative' }
export interface Lead { id:string; phone:string; status:LeadStatus; name?:string; companyName?:string; languagePreference?:'hi'|'en'|'hinglish'; nextCallbackAt?:Date; updatedAt:Date }
export interface LeadEvent { id:string; leadId:string; type:string; occurredAt:Date; actor:'SYSTEM'|'AI'|'USER'; metadata:Record<string,unknown> }
export interface Transition { nextState:ConversationState; leadStatus?:LeadStatus; createCallback?:boolean; requestTransfer?:boolean; suppress?:boolean; responseKey:string }

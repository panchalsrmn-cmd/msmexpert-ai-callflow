import http from 'node:http';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { exotelEnabled, startExotelCall } from './exotel-provider.mjs';

const port=Number(process.env.API_PORT||3001);
const secret=process.env.SESSION_SECRET;
const isProduction=process.env.NODE_ENV==='production';
if(isProduction&&!secret) throw new Error('SESSION_SECRET is required in production.');
const leadStore=[];
const requests=new Map();
const requestLimit=120;

function write(res,status,body,requestId){res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-request-id':requestId,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':'no-store'});res.end(JSON.stringify(body));}
function hash(value){return createHash('sha256').update(value).digest('hex')}
function unauthorized(res,id){return write(res,401,{error:{code:'UNAUTHORIZED',message:'Authentication is required.',requestId:id}},id)}
function allowed(req){const expected=process.env.DEV_API_TOKEN;if(!expected) return !isProduction;const supplied=req.headers.authorization?.replace(/^Bearer\s+/i,'')||'';if(supplied.length!==expected.length)return false;return timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));}
function clientAllowed(req){const key=req.socket.remoteAddress||'unknown',now=Date.now(),record=requests.get(key)||{started:now,count:0};if(now-record.started>60_000){record.started=now;record.count=0}record.count++;requests.set(key,record);return record.count<=requestLimit}
function normalizePhone(value){const local=String(value||'').replace(/[\s().-]/g,'').replace(/^\+91/,'').replace(/^0091/,'').replace(/^91(?=\d{10}$)/,'').replace(/^0(?=[6-9]\d{9}$)/,'');if(!/^[6-9]\d{9}$/.test(local))throw new Error('Enter a valid 10 digit Indian mobile number.');return `+91${local}`}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('Payload too large.')}try{return raw?JSON.parse(raw):{}}catch{throw new Error('Malformed JSON request body.')}}

http.createServer(async(req,res)=>{const requestId=req.headers['x-request-id']||randomUUID();if(!clientAllowed(req))return write(res,429,{error:{code:'RATE_LIMITED',message:'Too many requests.',requestId}},requestId);if(req.method==='GET'&&req.url==='/health')return write(res,200,{data:{status:'ok',service:'msmexpert-callflow-api',time:new Date().toISOString()}},requestId);if(!req.url?.startsWith('/api/v1/'))return write(res,404,{error:{code:'NOT_FOUND',message:'Route not found.',requestId}},requestId);if(!allowed(req))return unauthorized(res,requestId);try{if(req.method==='GET'&&req.url==='/api/v1/leads'){return write(res,200,{data:{items:leadStore,page:{cursor:null,hasMore:false}}},requestId)}if(req.method==='POST'&&req.url==='/api/v1/leads'){const input=await body(req),phone=normalizePhone(input.phone);const existing=leadStore.find(x=>x.phone===phone);if(existing)return write(res,200,{data:{lead:existing,replayed:true}},requestId);const lead={id:randomUUID(),name:typeof input.name==='string'?input.name.trim():null,companyName:typeof input.companyName==='string'?input.companyName.trim():null,phone,status:'NEW',createdAt:new Date().toISOString(),event:{type:'LEAD_CREATED',idempotencyKey:hash(`${phone}:${requestId}`)}};leadStore.push(lead);return write(res,201,{data:{lead,replayed:false}},requestId)}if(req.method==='POST'&&req.url==='/api/v1/calls'){if(!exotelEnabled())throw new Error('Set TELEPHONY_PROVIDER=exotel to place live calls.');const input=await body(req),to=normalizePhone(input.to),callId=randomUUID(),call=await startExotelCall({to,callId});return write(res,201,{data:{call:{id:callId,providerCallId:call.providerCallId,status:call.rawStatus||'QUEUED',to}}},requestId)}return write(res,404,{error:{code:'NOT_FOUND',message:'Route not found.',requestId}},requestId)}catch(error){const message=error instanceof Error?error.message:'Unexpected error.';return write(res,message==='Payload too large.'?413:400,{error:{code:'VALIDATION_ERROR',message,requestId}},requestId)}}).listen(port,'127.0.0.1',()=>console.log(`MSMExpert API listening on http://127.0.0.1:${port}`));

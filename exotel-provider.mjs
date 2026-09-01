/** Server-only adapter for Exotel's Voice Connect API. */
function required(name) { const value=process.env[name]; if(!value) throw new Error(`${name} is required for Exotel calling.`); return value; }
export function exotelEnabled() { return process.env.TELEPHONY_PROVIDER==='exotel'; }
export async function startExotelCall({to,callId}) {
  const accountSid=required('EXOTEL_ACCOUNT_SID'),apiKey=required('EXOTEL_API_KEY'),apiToken=required('EXOTEL_API_TOKEN'),callerId=required('EXOTEL_FROM_NUMBER');
  const flowUrl=required('EXOTEL_FLOW_URL');
  const streamUrl=process.env.EXOTEL_STREAM_URL;
  const apiDomain=(process.env.EXOTEL_API_DOMAIN||'https://api.exotel.com').replace(/\/$/,'');
  if (!streamUrl) throw new Error('EXOTEL_STREAM_URL is required for AI calling.');

  // AgentStream's direct Voice AI mode dials the customer itself and attaches
  // the answered leg to our bot. Do not send a `To` field: that invokes the
  // old two-number bridge and rings the account owner's configured number.
  // The account's legacy API connects the answered customer directly to Url.
  const form=new FormData();
  const fields={
    From:to,
    CallerId:callerId,
    Url:flowUrl,
    CallType:'trans',
    CustomField:callId,
  };
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  const response=await fetch(`${apiDomain}/v1/Accounts/${encodeURIComponent(accountSid)}/Calls/connect.json`,{method:'POST',headers:{authorization:`Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString('base64')}`,accept:'application/json'},body:form});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) {
    const detail=payload?.RestException?.Message||payload?.message||payload?.error||JSON.stringify(payload).slice(0,500);
    throw new Error(`Exotel returned HTTP ${response.status}: ${detail || 'Unknown error.'}`);
  }
  const sid=payload?.Call?.Sid||payload?.Sid; if(!sid) throw new Error('Exotel did not return a call SID.'); return {providerCallId:sid,rawStatus:payload?.Call?.Status};
}

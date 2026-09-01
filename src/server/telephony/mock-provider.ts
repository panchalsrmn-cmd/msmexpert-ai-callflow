import type { TelephonyProvider } from '../contracts';
export class MockTelephonyProvider implements TelephonyProvider {
  readonly initiated:Array<{callId:string;from:string;to:string;webhookUrl:string}>=[]; readonly transfers:Array<{providerCallId:string;to:string}>=[];
  async initiateCall(input:{callId:string;from:string;to:string;webhookUrl:string}){this.initiated.push(input);return {providerCallId:`mock_${input.callId}`}}
  async terminateCall(){/* tracked by the test caller if desired */}
  async transferCall(input:{providerCallId:string;to:string}){this.transfers.push(input)}
}

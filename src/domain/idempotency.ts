export class IdempotencyStore<T> {
  private values=new Map<string,T>();
  execute(key:string, factory:()=>T):{value:T; replayed:boolean}{
    const existing=this.values.get(key); if(existing!==undefined)return {value:existing,replayed:true};
    const value=factory(); this.values.set(key,value); return {value,replayed:false};
  }
}

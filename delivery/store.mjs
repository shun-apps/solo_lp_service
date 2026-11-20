/**
 * Cloudflare D1 を状態の正本にする。
 * 同一顧客用Workerごとに専用DBを割り当て、バージョン競合を避けて更新する。
 * このファイルは納品版の独立DBに接続するときのみ使用する。
 */
import {transitionCustomerState} from "./customer-rules.mjs";

const fetchCurrent=async db=>{
  const row=await db.prepare("SELECT version, data FROM customer_state WHERE id = 1").first();
  if(!row)throw Error("database_not_initialized");
  const state=JSON.parse(row.data);
  if(!Number.isInteger(row.version))throw Error("invalid_state_version");
  return {version:row.version,state};
};
export async function readCustomerState(db){
  return fetchCurrent(db);
}

/**
 * 競合が発生したらD1の最新状態を読み直して検証し直す。
 * これによりイベントの残席が1席の際の二重申込を防ぐ。
 */
export async function performCustomerAction(db,action,payload,{maxRetries=5}={}){
  if(!Number.isInteger(maxRetries)||maxRetries<1||maxRetries>10)throw Error("invalid_retries");
  for(let attempt=0;attempt<maxRetries;attempt++){
    const {version,state}=await fetchCurrent(db);
    const updated=transitionCustomerState(state,action,payload);
    const r=await db.prepare(
      "UPDATE customer_state SET data = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND version = ?"
    ).bind(JSON.stringify(updated.state),version).run();
    if(r?.success===false)throw Error("database_write_failed");
    if(r?.meta?.changes===1)return {version:version+1,result:updated.result};
    if(r?.meta?.changes!==0)throw Error("database_write_unknown");
  }
  throw Error("concurrent_update_retry");
}

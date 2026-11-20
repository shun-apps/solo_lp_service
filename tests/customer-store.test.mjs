import test from "node:test";
import assert from "node:assert/strict";
import {performCustomerAction,readCustomerState} from "../delivery/store.mjs";
import {emptyCustomerState} from "../delivery/customer-rules.mjs";

function fakeD1(state=emptyCustomerState()){
  let current={version:0,data:JSON.stringify(state)};
  let forceConflict=false;
  const db={
    conflictOnce(){forceConflict=true;},
    prepare(sql){
      if(sql.startsWith("SELECT"))return {first:async()=>({...current})};
      if(sql.startsWith("UPDATE"))return {bind(data,version){
        return {run:async()=>{
          if(forceConflict){forceConflict=false;current.version++;return {success:true,meta:{changes:0}};}
          if(version!==current.version)return {success:true,meta:{changes:0}};
          current={version:current.version+1,data};
          return {success:true,meta:{changes:1}};
        }};
      }};
      throw Error("unsupported_mock_sql");
    }
  };
  return db;
}
test("保存済みの実イベントをD1から読み出し再編集できる",async()=>{
 const db=fakeD1();
 const created=await performCustomerAction(db,"create_or_update_event",{
  title:"ワークショップ",date:"2027-05-05",time:"10:00",capacity:12
 });
 assert.equal(created.version,1);
 const state=(await readCustomerState(db)).state;
 assert.equal(state.events.length,1);
 const edited=await performCustomerAction(db,"create_or_update_event",{
  id:created.result.id,title:"ワークショップ",date:"2027-06-07",time:"15:00",capacity:8
 });
 assert.equal(edited.version,2);
 assert.equal((await readCustomerState(db)).state.events[0].date,"2027-06-07");
});
test("同時書き込み競合は最新版を再検証して保存する",async()=>{
 const db=fakeD1();
 db.conflictOnce();
 const saved=await performCustomerAction(db,"set_shop_name",{name:"アトリエ"});
 assert.equal(saved.version,2);
 assert.equal((await readCustomerState(db)).state.businessName,"アトリエ");
});
test("不正な操作はD1に保存されない",async()=>{
 const db=fakeD1();
 await assert.rejects(()=>performCustomerAction(db,"create_or_update_event",{
  title:"",date:"2027-05-05",time:"10:00",capacity:0
 }),/invalid_title/);
 assert.equal((await readCustomerState(db)).version,0);
});

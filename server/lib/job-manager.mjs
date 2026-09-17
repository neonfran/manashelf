import crypto from "node:crypto";
export class JobManager{
  constructor({maxJobs=32}={}){this.maxJobs=maxJobs;this.jobs=new Map();}
  create(type,meta={}){if(this.jobs.size>=this.maxJobs){const done=[...this.jobs.values()].filter(x=>!["running","queued"].includes(x.status)).sort((a,b)=>a.updatedAt-b.updatedAt);if(done[0])this.jobs.delete(done[0].id);}const now=Date.now(),job={id:crypto.randomUUID(),type,status:"queued",progress:0,message:"",meta,createdAt:now,updatedAt:now,error:null,result:null,cancelRequested:false};this.jobs.set(job.id,job);return job;}
  update(id,patch={}){const job=this.jobs.get(id);if(!job)return null;Object.assign(job,patch,{updatedAt:Date.now()});return job;}
  start(id,message=""){return this.update(id,{status:"running",message});}
  finish(id,result=null){return this.update(id,{status:"done",progress:1,result});}
  fail(id,error){return this.update(id,{status:"error",error:String(error?.stack||error),message:String(error?.message||error)});}
  cancel(id){return this.update(id,{cancelRequested:true,message:"Cancellation requested"});}
  get(id){return this.jobs.get(id)||null;}
  list(){return [...this.jobs.values()].map(x=>({...x}));}
}

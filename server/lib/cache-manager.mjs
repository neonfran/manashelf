export class CacheManager{
  constructor(){this.namespaces=new Map();}
  ns(name){if(!this.namespaces.has(name))this.namespaces.set(name,new Map());return this.namespaces.get(name);}
  get(namespace,key,{ttlMs=Infinity}={}){const row=this.ns(namespace).get(key);if(!row)return undefined;if(Date.now()-row.at>ttlMs){this.ns(namespace).delete(key);return undefined;}return row.value;}
  set(namespace,key,value){this.ns(namespace).set(key,{at:Date.now(),value});return value;}
  delete(namespace,key){return this.ns(namespace).delete(key);}
  clear(namespace=null){if(namespace==null)this.namespaces.clear();else this.namespaces.delete(namespace);}
  stats(){return Object.fromEntries([...this.namespaces].map(([k,v])=>[k,v.size]));}
}

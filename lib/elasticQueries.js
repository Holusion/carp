'use strict';

function count(scope,media){
  return {
    query: {
      query_string: {
        query: `request: "/playlist/${encodeURIComponent(scope)}/${encodeURIComponent(media)}.mp4" AND (response: 200 OR (response:206  AND offset: 0) OR response: 304)`,
        "analyze_wildcard": true
      }
    }
  }
}

//Flatten a batch query into an array of sources and an array of queries.
//see tests for formats
function reduceMsearch(op, items){
  return Object.keys(items).reduce(function(r,scope){
    r.items = r.items.concat(items[scope].map(function(media){
      return {name:media,scope:scope};
    }))
    r.queries = r.queries.concat(items[scope].reduce(function(ar, media){
      ar.push({});
      ar.push(op(scope,media));
      return ar;
    },[]));
    return r;
  },{items:[],queries:[]});
}

function expandMsearch(q, r){
  const responses = r.responses;
  if(q.items.length != responses.length){
    throw new Error("queries and responses length must match");
  }

  return q.items.reduce(function(out,item,index){
    //create scope if it doesn't exist
    let scope_res = out[item.scope]||{};
    if(responses[index] && responses[index].hits){
      scope_res[item.name] = responses[index].hits.total;
    }else{
      scope_res[item.name] = 0;
      console.warn("Invalid response : ",responses[index]);
    }

    out[item.scope] = scope_res;
    return out;
  },{});
}
// sequence of fn(scope,media,views) or fn(scope,media) depending if it's called with requests or results.
function iterate(batch,fn){
  Object.keys(batch).forEach(function(scope){
    if(Array.isArray(batch[scope])){
      batch[scope].forEach(function(media){
        fn(scope,media);
      })
    }else{
      Object.keys(batch[scope]).forEach(function(media){
        fn(scope,media,batch[scope][media]);
      })
    }
  })
}
module.exports = {reduceMsearch, expandMsearch, count, iterate};

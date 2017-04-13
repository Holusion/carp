'use strict';
const store = {};
const cache_time = 1000*3600*4
function get(scope,media){
  if(!store[scope] || typeof store[scope][media] === "undefined"){
    return null;
  }
  let diff = Date.now() -  store[scope][media][1];
  //diff in milliseconds -> 4 hours
  if( cache_time < diff ){
    //don't remove cache-busted items as they *will* get updated.
    return null;
  }

  return store[scope][media][0];
}

//forced_date is used for testing
function set(scope,media,value,forced_date){
  if(typeof store[scope] == "undefined"){ store[scope]={}};
  store[scope][media] = [value, forced_date || Date.now()];
}

function getCachedValues(list){
  return Object.keys(list).reduce(function(results,scope){
    list[scope].forEach(function(media){
      let views = get(scope,media);
      if(views != null){
        results.cached[scope] = results.cached[scope]||{};
        results.cached[scope][media] = views;
      }else{
        results.uncached[scope] = results.uncached[scope]||[];
        results.uncached[scope].push(media);
      }
    });
    return results;
  },{cached:{},uncached:{}});
}

module.exports = {get, set, getCachedValues, cache_time};

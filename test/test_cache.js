'use strict';
const expect = require("chai").expect;
const cache = require("../lib/cache");


describe("cache",function(){
  it("sort cached and uncached entries",function(){
    cache.set("foo","bar",128);
    expect(cache.getCachedValues({foo:["bar","baz"]})).to.deep.equal({
      cached:{
        foo:{bar:128}
      },
      uncached:{foo:["baz"]}
    });
  });
  it("cache bust",function(){
    cache.set("foo","bar",128,Date.now()-cache.cache_time -10);
    expect(cache.getCachedValues({foo:["bar","baz"]})).to.deep.equal({
      cached:{},
      uncached:{foo:["bar","baz"]}
    });
  });
})

'use strict';
const http = require('http');
const jsonBodyParser = require("body-parser").json();
const express = require("express");
const elasticsearch = require('elasticsearch');
const queries = require("./elasticQueries");
const cache = require("./cache");

function countAll(callback){
  const q = {
    query: {
      query_string: {
        query: `request: /playlist/*.mp4 AND (response: 200 OR (response:206  AND offset: 0) OR response: 304)`,
        "analyze_wildcard": true
      }
    }
  }
  client.search(q,function(err,res){
    if(err != null){
      return callback(err);
    }
    return callback(null,res.hits.total);
  });
}

function batchCount(things,callback){

  //sort cached / uncached requests
  const requests = cache.getCachedValues(things);
  //Serialize. We use an intermediate object to find back scope & name after elasticsearch answers
  const batch = queries.reduceMsearch(queries.count, requests.uncached);
  //Extract queries for mquery()

  function parseResults(err,data){
    if(err){
      return callback(err);
    }
    //Use this to debug future ElasticSearch response syntax changes
    //console.log("ES Response Raw : ", data);
    const responses = data.responses;
    //console.log("Raw results :",data.responses);
    //Deserialize to find results structure
    const formatted_results = queries.expandMsearch(batch,data);
    //Merge cached results and new queries. Add new queries to cache.
    queries.iterate(formatted_results,function(scope,media,views){
      cache.set(scope,media,views);
      if(!requests.cached[scope]){
        requests.cached[scope] = {};
      }
      requests.cached[scope][media]=views;
    });
    callback(null,requests.cached);
  };
  if(0 < batch.queries.length){
    client.msearch({body:batch.queries},parseResults)
  }else{
    parseResults(null,{responses:[]});
  }
}


function count(scope, media, callback){
  const q = queries.count(scope,media);
  client.search(q,function(err,res){
    if(err != null){
      return callback(err);
    }
    return callback(null,res.hits.total);
  });
}


function enableCORS(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"/*"https://pixel.holusion.com"*/);
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
};

// BOOTSTRAP //
const client = new elasticsearch.Client({
  apiVersion: "5.0",
  host: 'localhost:9200',
  log: 'info'
});

client.ping({
  requestTimeout: 10000,
}, function (error) {
  if (error) {
    console.error('elasticsearch cluster is down!');
  } else {
    console.log('All is well');
  }
});

const app = express();
app.use(enableCORS);
app.get("/",function(req, res){
  countAll(function(err,count){
    if( err != null ){
      return res.status(err.status||500).send(
        (err.root_cause)?JSON.stringify(err.root_cause[0]):err
      );
    }
    res.set("Content-Type","text/plain");
    res.send(count.toString());
  });
});
app.post("/batch",jsonBodyParser, function(req,res){
  if(typeof req.body.count != "object"){
    return res.status(400).send({code:400,message:"Request must have a count field"});
  }
  batchCount(req.body.count,function(err, data){
    if(err){
      return res.status(err.status||500).send(
        (err.root_cause)?JSON.stringify(err.root_cause[0]):err
      );
    }
    res.set("Content-Type","application/json");
    res.send({count:data});
  });
});
app.get("/count/:scope/:media",function(req,res){
  count(req.params.scope,req.params.media,function(err,count){
    if(err){
      return res.status(err.status||500).send(
        (err.root_cause)?JSON.stringify(err.root_cause[0]):err
      );
    }
    res.set("Content-Type","text/plain");
    res.send(count.toString());
  });
});
const port = process.env["PORT"] || 3000;
app.listen(port, function () {
  console.log(`app listening on port ${port}!`);
})

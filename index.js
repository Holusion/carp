'use strict';
const http = require('http');
const jsonBodyParser = require("body-parser").json();
const express = require("express");

const elastic_host = "localhost"
const elastic_port = 9200

function parse(data,callback){
  if(typeof data == "string"){
    try{
      data = JSON.parse(data);
    }catch(e){
      return callback(new Error(`Expected a valid JSON object`));
    }
  }
  if( data.timed_out == true){
    return callback(new Error("Requerst timed out"));
  }
  callback(null, data);
}
function query(query, callback){
  return request("search",JSON.stringify(query),callback);
}

//elasticsearch's batch API
function mquery(queries, callback){
  const data = queries.reduce(function(str,q){
    return str+'{"index" : "filebeat-*"}\n'+JSON.stringify(q)+"\n";
  },'');
  console.log("string : ",data);
  return request('msearch',data,callback);
}

function request(type,postData,callback){
  var body = "";
  var has_error = false;
  const path = (type =="msearch")?"/_msearch":"/_search";
  const contentType = "application/"+(type =="msearch")?'x-ndjson':'json';
  const options = {
    hostname: elastic_host,
    port: elastic_port,
    path: path,
    method: "GET",
    headers: {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  const req = http.request(options, (res) => {

    res.setEncoding('utf8'); //TODO : use headers to check encoding
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if(has_error) return; //callback already called
      if(res.statusCode != 200){
        return callback(new Error(`Request to elasticsearch returned status ${res.statusCode} : ${body}`));
      }else{
        return parse(body,callback);
      }
    });
  });

  req.on('error', (e) => {
    has_error = true;
    return callback(new Error(`Request to elasticsearch encountered an error : ${e.message}`));
  });

  // write data to request body
  req.write(postData);
  req.end();
}

function countAll(callback){
  const q = {
    query: {
      query_string: {
        query: `request: /playlist/*.mp4 AND (response: 200 OR (response:206  AND offset: 0) OR response: 304)`,
        "analyze_wildcard": true
      }
    }
  }
  query(q,function(err,res){
    if(err != null){
      return callback(err);
    }
    return callback(null,res.hits.total);
  });
}

function batchCount(things,callback){
  //Serialize
  const formatted_batch = Object.keys(things).reduce(function(r,scope){
    return r.concat(things[scope].map(function(media){
      return {name:media,scope:scope,query:makeCountQuery(scope,media)};
    }))
  },[]);
  //Extract queries for mquery()
  const qs = formatted_batch.map(function(r){
    return r.query;
  });
  mquery(qs,function(err,data){
    if(err){
      return callback(err);
    }
    const responses = data.responses;
    //console.log("Raw results :",data.responses);
    //Run through original request to find results structure
    const formatted_results = formatted_batch.reduce(function(r,item,index){
      //create scope if it doesn't exist
      let scope_res = r[item.scope]||{};
      scope_res[item.name] = responses[index].hits.total;
      r[item.scope] = scope_res;
      return r;
    },{});
    callback(null,formatted_results);
  });
}

function makeCountQuery(scope,media){
  return {
    query: {
      query_string: {
        query: `request: "/playlist/${encodeURIComponent(scope)}/${encodeURIComponent(media)}.mp4" AND (response: 200 OR (response:206  AND offset: 0) OR response: 304)`,
        "analyze_wildcard": true
      }
    }
  }
}

function count(scope, media, callback){
  const q = makeCountQuery(scope,media);
  query(q,function(err,res){
    if(err != null){
      return callback(err);
    }
    return callback(null,res.hits.total);
  });
}
function enableCORS(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://pixel.holusion.com");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
};

// BOOTSTRAP //

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
app.get("/batch",jsonBodyParser, function(req,res){
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

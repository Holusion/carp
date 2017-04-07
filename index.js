'use strict';
const http = require('http');
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

function query(query,callback){
  var body = "";
  var has_error = false;
  const postData = JSON.stringify(query);
  const options = {
    hostname: elastic_host,
    port: elastic_port,
    path: '/_search',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
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
function count(scope, media, callback){
  const q = {
    query: {
      query_string: {
        query: `request: /playlist/${scope}/${media}.mp4 AND (response: 200 OR (response:206  AND offset: 0) OR response: 304)`,
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
const app = express();
countAll(function(err,res){
  if(err != null){
    return console.error(err);
  }
  console.log("Total hits : ",res);
});
app.get("/",function(req, res){
  countAll(function(err,count){
    if( err != null ){
      return res.status(500).send(err);
    }
    res.set("Content-Type","text/plain");
    res.send(count.toString());
  });
});
app.get("/:scope/:media",function(req,res){
  count(req.params.scope,req.params.media,function(err,count){
    if( err != null ){
      return res.status(500).send(err);
    }
    res.set("Content-Type","text/plain");
    res.send(count.toString());
  });
});
const port = process.env["PORT"] || 3000;
app.listen(port, function () {
  console.log(`app listening on port ${port}!`);
})

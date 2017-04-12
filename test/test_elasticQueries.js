const expect = require("chai").expect;
const queries = require("../lib/elasticQueries");

describe("elasticQueries",function(){
  describe("reduceMsearch()",function(){
    [
      [
        "simple reduction",
        {holusion:["foo"]},
        {
          items:[{scope:"holusion",name:"foo"}],
          queries:[{}, queries.count("holusion","foo")]
        }
      ],[
        "multiple scope reduction",
        {holusion:["foo"],bar:["bar"]},
        {
          items:[
            {scope:"holusion",name:"foo"},
            {scope:"bar",name:"bar"}
          ],
          queries:[
            {},
            queries.count("holusion","foo"),
            {},
            queries.count("bar","bar")
          ]
        }
      ],
    ].forEach(function(f){
      it(`${f[0]}`,function(){
        expect(queries.reduceMsearch(queries.count,f[1])).to.deep.equal(f[2]);
      })
    })
  })
  describe("expandMsearch()",function(){
    [
      [
        "simple expansion",
        {items:[{scope:"holusion",name:"foo"},{scope:"holusion",name:"bar"}]}, //we don't use the query field
        {responses:[{hits:{total:128}},{hits:{total:256}}]},
        {holusion:{foo:128,bar:256} }
      ],
    ].forEach(function(f){
      it(`${f[0]}`,function(){
        expect(queries.expandMsearch(f[1],f[2])).to.deep.equal(f[3]);
      })
    })
  })
})

#Usage


### GET /count/:scope/:name

get viewcount for video `:name` in scope `:scope`.

# GET /batch

batch request. Accepts a JSON body as :
```
{
  "count":{
    "scope_1":[
      "media_1",
      "media_2"
    ],
    "scope_2":[
      "media_3"
    ]
  }
}
```

Response :
```
{
  "count":{
    "scope_1":{
      "media_1":1,
      "media_2":10
    },
    "scope_2":{
      "media_3":100
    }
  }
}
```

### GET /

(unstable)
count all views on all videos

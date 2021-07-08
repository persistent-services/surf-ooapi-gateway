#!/bin/bash

curl -v -u fred:96557fbdbcf0ac9d83876f17165c0f16 -H "X-Route: endpoint=TestBackend" http://localhost:8081/courses


#  echo -n '{ "version": "1.1", "host": "example.org", "short_message": "A short message", "level": 5, "_some_info": "foo" }' | nc -w0  localhost 12201

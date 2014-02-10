#!/bin/bash

curl -X POST \
  -H "X-Parse-Application-Id: zaZmkcjbGLCrEHagb8uJPt5TKyiFgCg9WffA6c6M" \
  -H "X-Parse-REST-API-Key: ZjCVp64qsDxYWw6PktZgc5PFZLdLmRuHe9oOF3q9" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://api.parse.com/1/functions/userinfo

echo 

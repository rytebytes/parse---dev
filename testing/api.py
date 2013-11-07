#from urllib2 import request
import urllib2
import json, httplib

class ParseClient:

  def __init__(self):
    self.connection = httplib.HTTPSConnection('api.parse.com', 443)
    self.connection.connect()

  def call_function(self, name, params):
    path = "/1/functions/{0}".format(name)
    print('\n' + path)
    self.connection.request('POST', path, json.dumps(params), {
       'X-Parse-Application-Id' : 'zaZmkcjbGLCrEHagb8uJPt5TKyiFgCg9WffA6c6M',
       'X-Parse-REST-API-Key'   : 'ZjCVp64qsDxYWw6PktZgc5PFZLdLmRuHe9oOF3q9',
       'Content-Type'           : 'application/json'
      })
    response = self.connection.getresponse().read().decode()
    print(response)
    return json.loads(response)

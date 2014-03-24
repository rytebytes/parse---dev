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
       'X-Parse-Application-Id' : 'UDW2iXLErRqiBp7ftE8wJpmymYft3r67QvwD0pDn',
       'X-Parse-REST-API-Key'   : 'mVU56FqCVg3456DF0Q1ey6ZXQTZHdy7R3TSX7Llu',
       'Content-Type'           : 'application/json'
      })
    response = self.connection.getresponse().read().decode('utf-8')
    print(response)
    return json.loads(response)

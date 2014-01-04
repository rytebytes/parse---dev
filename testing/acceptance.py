import unittest

from api import ParseClient

class AcceptanceTest(unittest.TestCase):

	# def test_ORDER_no_user_id_error(self):
	# 	response = ParseClient().call_function('order', {})
	# 	assert response['error'] == 'No user id provided with order.'

	# def test_ORDER_no_location_id_error(self):
	# 	response = ParseClient().call_function('order', { 'userId' : '3' })
	# 	assert response['error'] == 'No location id provided with order.'

	# def test_ORDER_no_order_items_error(self):
	# 	response = ParseClient().call_function('order', { 'userId' : '3', 'locationId' : '3' })
	# 	assert response['error'] == 'No items provided with order.'

	def test_LOCATION_ITEM_quantity(self):
		response = ParseClient().call_function('order', 
			{ 
				'userId' : 'vgzEGVAfCU', 
				'locationId' : 'jYkEfbIMov', 
				'orderItemDictionary' : 
				{
					'JO2eEQaQAS' : {'quantity' : '1'},
					'zNQHnmvC4r' : {'quantity' : '1'}
				}
			})
		assert response['result'] == 24

 # 	def test_should_call_hello_function(self):
 #   	response = ParseClient().call_function('hello', {})
 #   	assert response['result'] == 'world'

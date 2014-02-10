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

	# def test_No_stock_left_for_first_item_in_order(self):
	# 	response = ParseClient().call_function('order', 
	# 		{ 
	# 			'userId' : 'P41AIRwYNa', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'totalInCents' : 899, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['error'][0] == 'No items left for item : zNQHnmvC4r'

	# 	{"totalInCents":899,"locationId":"AaoWcS3rwi","orderItemDictionary":{"CrXkzvBWTk":{"quantity":1}},"userId":"P41AIRwYNa"}	

	def test_Passing_locationId_retrievemenu_returns_locationItem(self):
		response = ParseClient().call_function('retrievemenu', 
			{})
		# assert response['result'] == 24

	# def test_Credit_Card_Declined(self):
	# 	response = ParseClient().call_function('order', 
	# 		{ 
	# 			'userId' : 'exJYb6AxNV', 
	# 			'locationId' : 'jYkEfbIMov', 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'JO2eEQaQAS' : {'quantity' : '1'},
	# 				'zNQHnmvC4r' : {'quantity' : '1'}
	# 			}
	# 		})
 # 	def test_should_call_hello_function(self):
 #   	response = ParseClient().call_function('hello', {})
 #   	assert response['result'] == 'world'

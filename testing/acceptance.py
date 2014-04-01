import unittest

from api import ParseClient

class AcceptanceTest(unittest.TestCase):

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

	# def test_ORDER_Valid_Order_Inventory_Location_No_Charge_Sent_To_Stripe(self):
	# 	response = ParseClient().call_function('order',
	# 		{ 
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : '4LlYqSRdc2',
	# 			'totalInCents' : 100, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['result'] == 'success'
		
	# def test_ORDER_Valid_Order_With_0_For_Total_Succeeds(self):
	# 	response = ParseClient().call_function('order',
	# 		{ 
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'totalInCents' : 0, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['result'] == 'success'

	# def test_ORDER_Valid_Coupon_Code_Order_Succeeds(self):
	# 	response = ParseClient().call_function('order',
	# 		{ 
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'couponCode' : 'TESTING-valid-2',
	# 			'totalInCents' : 100, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['result'] == 'success'

	# def test_ORDER_Invalid_Coupon_Code_Order_Fails(self):
	# 	response = ParseClient().call_function('order',
	# 		{
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'couponCode' : 'testing-invalid',
	# 			'totalInCents' : 599, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['error'] == 'Coupon code is not valid - please try again!'

	# def test_ORDER_Expired_Coupon_Code_Order_Fails(self):
	# 	response = ParseClient().call_function('order',
	# 		{
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'couponCode' : 'testing-expired',
	# 			'totalInCents' : 599, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['error'] == 'This coupon has expired and is no longer valid!'

	# def test_COUPON_Valid_Code_And_Valid_User_And_Not_Expired_Returns_True(self):
	# 	response = ParseClient().call_function('coupon', 
	# 		{ 
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'couponCode' : 'testing-valid',
	# 			'totalInCents' : 899, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['result']['valid'] == True

	# def test_COUPON_Valid_Code_And_Valid_User_And_Expires_Today_Returns_True(self):
	# 	response = ParseClient().call_function('coupon', 
	# 		{ 
	# 			'userId' : 'Gt3GLJYx2D', 
	# 			'locationId' : 'AaoWcS3rwi',
	# 			'couponCode' : 'testing-today',
	# 			'totalInCents' : 899, 
	# 			'orderItemDictionary' : 
	# 			{
	# 				'CrXkzvBWTk' : {'quantity' : '1'},
	# 			}
	# 		})
	# 	assert response['result']['valid'] == True

	def test_COUPON_Valid_Code_And_Valid_User_And_Expired_Returns_False(self):
		response = ParseClient().call_function('coupon', 
			{ 
				'userId' : 'Gt3GLJYx2D', 
				'locationId' : 'AaoWcS3rwi',
				'couponCode' : 'testing-invalid',
				'totalInCents' : 899, 
				'orderItemDictionary' : 
				{
					'CrXkzvBWTk' : {'quantity' : '1'},
				}
			})
		assert response['result']['valid'] == False
		assert response['result']['message'] == 'This coupon has expired and is no longer valid!'

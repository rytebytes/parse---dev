
var Stripe = require ('stripe');
var _ = require('underscore');
var moment = require('moment');
var inventory = require('cloud/inventory_report.js');
var accounting = require('cloud/accounting.js');
var Mandrill = require('mandrill');

//Init Modules
Mandrill.initialize('KAszMl4utMaqTKy-ROWTcw');

Stripe.initialize('sk_test_0eORjVUmVNJxwTHqMLLCogZr');
//Stripe.initialize('sk_live_Bq60JoiLVW4UuubynRCqMFh4');

var LocationItem = Parse.Object.extend("LocationItem");
var Location = Parse.Object.extend("Location");
var MenuItem = Parse.Object.extend("MenuItem");
var OrderItem = Parse.Object.extend("OrderItem");
var Order = Parse.Object.extend("Order");
var User = Parse.Object.extend("User");
var UserCoupon = Parse.Object.extend("UserCoupon");

var STRIPE_ID = "stripe_id";

//This object has two properties
//  - message : a message to return to caller
//	- code : an error code specifying what happened so error handlers can react appropriately
//		- 01 - an item in the 
var OrderingError = Parse.Object.extend("OrderingError");


/*
	Rules for validation:
		- not expired
		- not used before 
 */
function validateCoupon(couponCode,userId) {
	console.log("Enter validateCoupon");

	var query = new Parse.Query("Coupon");
	var couponAmount;

	var couponPromise = new Parse.Promise();

	query.equalTo("code",couponCode);

	Parse.Promise.as().then(
		function(){
			return query.find();
		}
	).then(
		function(couponResults){

			if(couponResults.length == 0){
				return Parse.Promise.error("No valid coupon found - please try again!");
			}

			var coupon = couponResults[0];

			couponAmount = coupon.get("value");

			var userCouponQuery = new Parse.Query("UserCoupon");
			query.equalTo("userId",userId);
			query.equalTo("couponCode",coupon.get("code"));

			var expire = new Date(coupon.get("expiration"));

			if(expire > new Date()){
				//valid date - check if user has used it before
				return userCouponQuery.find();
			} else {
				return Parse.Promise.error("This coupon has expired and is no longer valid!");
			}
		}
	).then(
		function(userCouponObjectResults){
			console.log("userCouponObjectResults length : " + userCouponObjectResults.length);
			if(userCouponObjectResults.length > 0){
				return Parse.Promise.error("You have already used this coupon, it is no longer valid!");
			}
			return new Parse.Promise().resolve();
		}
	).then(
		function(promise){
			var couponResult = {
				valid : true,
				message : "",
				amount : couponAmount
			}
			couponPromise.resolve(couponResult);
		},
		function(error){
			var couponResult = {
				valid : false,
				message : error,
				amount : 0
			};
			couponPromise.reject(couponResult);
		}
	);

	return couponPromise;
}




/*
	Name : /content
	API Version Introduced : v2
	Parameters :
		- name (REQUIRED) - the name of the content to retrieve
	Returns : 
		- Text object
	Release notes :
		v2 - newly introduced in v2 to allow updating heating instructions
*/
Parse.Cloud.define("content",function(request,response){
	var query = new Parse.Query("Text");
	query.equalTo("name",request.params.name);
	query.find({
		success: function(results){
			if(results.length > 0){
				return response.success(results[0]);
			}
			else{
				return response.error("No content found with name : " + request.params.name);
			}
		},
		error: function(error){
			return response.error(error);
		}
	});
});

/*
	Name : /location
	API Version Introduced : v1
	Parameters : none
	Returns : 
		- location object, with charity information
	Release notes :
		v1 - none
 		v2 - 
*/
Parse.Cloud.define("location", function(request,response){
	var query = new Parse.Query("Location");
	query.include("charityId");
	query.find({
		success: function(results){
			return response.success(results);
		},
		error: function(error){
			return response.error(error);
		}
	});
});

/*
	Name : /charity
	API Version Introduced : v1 
	Parameters : none
	Returns : 
		- all charity objects
	Release notes :
		v1 - none
		v2 - 
*/
Parse.Cloud.define("charity",function(request,response){
	var query = new Parse.Query("Charity");
	query.find({
		success: function(results){
			return response.success(results);
		},
		error: function(error){
			return response.error(error);
		}
	});
});

/*
	Name : /retrievemenu
	API Version Introduced : v1
	Parameters : 
		v1 
			locationId (OPTIONAL) - used to request menu for a specific location
		v2
			locationId (REQUIRED) - request menu for specific location
	Returns : 
		v1  
			- if the locationId is specified, it will return a list of LocationItems
			- if there is no locationId, it will return the list of MenuItems
		v2
			- no changes
	Release notes :
		v1 - none
		v2 - Although the locationId is now required for all menu request, it isn't enforced on the backend to ensure backward compatibility 
*/
Parse.Cloud.define("retrievemenu", function(request,response){
	if(request.params.locationId){
		var query = new Parse.Query(LocationItem);
		query.include("menuItemId");
		query.include("menuItemId.nutritionInfoId");

		console.log("retrieve location menu for : " + request.params.locationId);
		var location = new Location();
		location.set("id",request.params.locationId);

		query.equalTo("locationId",location);
		
		query.find({
			success: function(results){
				return response.success(results);
			},
			error: function(error){
				return response.error(error);
			}
		});
	} else{
		var query = new Parse.Query(MenuItem);
		query.include("nutritionInfoId");
		query.find({
			success: function(results){
				return response.success(results);
			},
			error: function(error){
				return response.error(error);
			}
		});
	}
});

/*
	Name : /itemquantity
	API Version Introduced: v1
	Parameters : 
		v1
			objectId (REQUIRED) - the unique id of the locationItem that the quantity is being requested for
		v2
			no changes
	Returns : 
		- the number of items remaining at that location
	Release notes :
		v1 - none
 
*/
Parse.Cloud.define("itemquantity", function(request,response){
	var query = new Parse.Query("LocationItem");
	query.equalTo("objectId",request.params.objectId);
	query.find({
		success: function(results){
			if(results.length > 0){
				return response.success(results[0].get("quantity"));	
			}
			else{
				return response.success("no item found for objectId : " + request.params.objectId);
			}
			
		},
		error: function(error){
			return response.error(error);
		}
	});
});

/*
	Name : /getlocation
	API Version Introduced: 
	Parameters : 
	Returns : 
	Release notes :
 
*/
Parse.Cloud.define("getlocation", function(request,response){
	var query = new Parse.Query(Location);
	query.equalTo("objectId",request.params.objectId);
	query.include("charityId");
	query.find({
		success: function(results){
			if(results.length > 0){
				return response.success(results);
			}
			else{
				return response.error("No location found with objectId : " + request.params.objectId);
			}
		},
		error: function(error){
			return response.error(error);
		}
	});
});

//receive order object with coupon attribute
//check if coupon is valid
//always return the following:
// valid : yes/no
// error message : empty if it was a valid code, otherwise an error to be displayed
// amount : amount to deduct from order when app places it
Parse.Cloud.define("coupon",function(request,response){
	Parse.Promise.as().
	then(
		function(){
			return validateCoupon(request.params.couponCode,request.params.userId);
		}
	).then(
		function(couponResult){
			return response.success(couponResult);
		},
		function(couponResult){
			return response.success(couponResult);
		}
	);
});

/*
	Name :
	API Version :
	Parameters : 
	Returns : 
	Release notes :
 
*/
/*
Web Service to place an order. Requires an order object:
{
	couponCode : <coupon code> //added in V2
	userId : <User objectId>, //added in V2
	locationId : <Location objectId>, //added in V2
	totalInCents: <order amount in USD cents>, //added in V2
	orderItemDictionary: //added in V2
		{
			"SxftUkXojG":{"quantity":1},
			"zNQHnmvC4r":{"quantity":1},
			"wh9pDZaqm6":{"quantity":0},
			"D6a4LyLvi7":{"quantity":1},
			"u004g2tbaA":{"quantity":0}
		}
	}
}
*/
Parse.Cloud.define("order", function(request,response){
	console.log("received order : " + request.params);
	var locationId, userId, orderItems;

	//error checking should also verify that the userid & locationid are valid values
	if(request.params.userId == null)
		return response.error("No user id provided with order.");

	if(request.params.locationId == null)
		return response.error("No location id provided with order.");

	if(request.params.orderItemDictionary == null)
		return response.error("No items provided with order.");

	/*
	- have to write order first, & then create order items b/c they need a pointer to the order
	- Things to be done when an order is sent:
	1. create order object & save

	1. find user object to get the stripe token
	2. lookup inventory at location to ensure enough stock
	3. update inventory & charge card
	   TRANSACTION
	   a. decrement stock at location for all items in order
	   b. call stripe to charge card
	   END TRANSACTION
   	4. send receipt
   	5. update user order history with order
   	6. 
	*/

	var orderingError;

	orderItems = request.params.orderItemDictionary;
	userId = request.params.userId;
	locationId = request.params.locationId;

	var location = new Location();
	location.set("id",locationId);

	var user = new User();
	user.set("id",userId);

	var currentOrder = new Order();
	currentOrder.set("locationId",location);
	currentOrder.set("totalInCents",request.params.totalInCents);
	currentOrder.set("userId",user);

	var quantityAvailable = -1;

	var query = new Parse.Query(Parse.User);
	var itemString = "";


	Parse.Promise.as().then(
		function(){
			if(request.params.couponCode){
				console.log("validating coupon code in order : " + request.params.couponCode);
				return validateCoupon(request.params.couponCode,request.params.userId);
			}
			return new Parse.Promise.as();
		}
	).then(
		function(couponResult){
			console.log("valid coupon");
			return new Parse.Promise.as();
		},
		function(couponResult){
			console.log("invalid coupon");
			return Parse.Promise.error("Invalid coupon, please enter a different coupon code!");
		}
	).then(
		function(){
			return query.get(userId);
		}
	).then(
		function(parseUser){
			var stripeId = parseUser.get("stripeId");
			console.log("stripe id : " + parseUser.get("stripeId"));
			console.log(stripeId.substring(0,3));
			if(stripeId.substring(0,3) == "tok") {//there was an error saving cc info to Stripe
				console.log("problem with cc data.");
				response.error("Error with credit card data, please go to the 'My Account' tab and update your information.");
			} else {
				return new Parse.Promise.as();
			}
		}
	).then(
		function(){ //save the current order object
			return currentOrder.save();
		}
	)
	.then(
		function(currentOrder) {
			console.log("new order id : " + currentOrder.id);
			var promise = Parse.Promise.as();
			_.each(orderItems,function(quantityObject, menuItemId, list){
				
				/*
				This code does the following:
					1) retrieve the menu item 
					2) create an order item
					3) look up the location item from the menu item & location passed in the order
					4) check the quantity for an item at a given location, if there's enough, decrement it by the order amount & save the LocationItem

				The order item objects are created before modifying the quantity on the location item object to ensure error handling can properly clean up
				if the order doesn't complete successfully.  The error handler at the bottom, will iterate over all order items for the order and both delete the order
				item and reset the quantity on the location item to what it was before, since this order is not being completed.  This way, the error handler will always adjust
				quantities for only items that have an order item entry.  This means that in the block below that adjusts quantities - if there isn't enough available, the quantity 
				will still be adjusted (even if the number goes negative) so that the error handler will adjust it appropriately.
				*/
				var quantityOrdered = parseInt(quantityObject['quantity']);
				var startQuantity;
				var menuItem = new MenuItem();
				menuItem.set("id",menuItemId);

				promise = promise.then(//create an order item
					function(){
						console.log("Creating order item for menuItem : (" + menuItemId + ") with a quantity of : " + quantityOrdered);
						var orderItem = new OrderItem();

						orderItem.set("menuItemId",menuItem);
						orderItem.set("quantity",quantityOrdered);
						orderItem.set("orderId",currentOrder);
						return orderItem.save();
					}
				).then(
					function(orderItem){ //find the location item for the menu item passed in
						console.log("find location item");
						var query = new Parse.Query(LocationItem);
						query.equalTo("locationId",location);
						query.equalTo("menuItemId",menuItem);
						query.include("menuItemId");
						return query.first();
					}
				).then( //update the quantity for the location item
					function(locationItem){
						if(null == locationItem){
							return Parse.Promise.error("<" + menuItemId + "> not available at the selected location.");
						} else {
							itemString = itemString + locationItem.get("menuItemId").get("name") + "<br>"
							startQuantity = locationItem.get("quantity");
							console.log("Modifying locationItem quantity.");
							console.log("Before adjustment: " + startQuantity);
							locationItem.increment("quantity",(-quantityOrdered));
							console.log("After adjustment: " + locationItem.get("quantity"));

							return locationItem.save();
						}
					}
				).then(
					function(locationItem){
						if(startQuantity < quantityOrdered){
							return Parse.Promise.error("<" + menuItemId + "> is currently sold out! Try again soon!");
						}
						return Parse.Promise();
					}
				);
			});
			return promise;
		}
	).then(
		function(){
			var query = new Parse.Query(Parse.User);
			return query.get(userId);
		},
		function(error){
			return error;
		}
	).then(
		function(userObject){
			stripeId = userObject.get("stripeId");
			user = userObject;
			return Stripe.Charges.create({
					amount: request.params.totalInCents, //in cents
					currency: 'usd',
					customer: stripeId,
					description: 'Thanks for your purchase of RyteBytes! Remember to keep frozen until ready to heat!<br>' +
								 'We donate 10% of our profits to your local food bank!<br>' +
								 'Items Ordered : ' + itemString 
			});
		},
		function(error){
			return error;
		}
	).then(
		function(purchase){
			console.log("purchase id : " + purchase.id);
			currentOrder.set("stripePurchaseId",purchase.id);
			return currentOrder.save();
		}
	).then(
		function(order){
			if(request.params.couponCode){
				console.log("creating user coupon object");
				var userCoupon = new UserCoupon();
				userCoupon.set("orderId",order);
				userCoupon.set("couponCode",request.params.couponCode);
				userCoupon.set("userId",order.get("userId"));
				return userCoupon.save();
			}	
		}
	).then(
		function(userCoupon){
			// console.log("saved order id : " + order.id);
			// console.log("stripe purchase id : " + order.get("stripePurchaseId"));
			// console.log("itemString : " + itemString);
			var amount = accounting.formatMoney(request.params.totalInCents / 100);
			Parse.Cloud.httpRequest({
				  method: 'POST',
				  url: 'https://mandrillapp.com/api/1.0/messages/send-template.json',
				  headers: {
				    'Content-Type': 'application/json'
				  },
				  body: {
				  	key: 'KAszMl4utMaqTKy-ROWTcw',
				  	template_name: 'Receipt v1',
				  	template_content: [{
				  		name:'items',
				  		content:itemString
				  	}],
				    message: {
						global_merge_vars: [{
							name:"ORDERTOTAL",
							content:amount
						}],
						subject: "RyteBytes Receipt",
						from_email:"info@myrytebytes.com",
						to: [{
								email:user.get("email")
						}]
					}
				  },
				  success: function(httpResponse) {
				    console.log(httpResponse.text);
				  },
				  error: function(httpResponse) {
				    console.error('Request failed with response code ' + httpResponse.status);
				  }
			});
			response.success("success");
		},
		function(error){ 
			//1. get order items, grab quant, delete
			//2. adjust location item quantity
			//3. delete order
			console.log("Error during order :  " + error.message);
			console.log("Removing data for orderId : " + currentOrder.id);

			orderingError = error;

			var promise = Parse.Promise.as();

			if(currentOrder.get("id") == null){
				console.log("In order error handler, currentOrder object has no id, so hasn't been saved. Don't need to remove order since it was never saved.");
				return response.error(error);
			}

			var query = new Parse.Query("OrderItem");
			query.equalTo("orderId",currentOrder);

			return query.find().then(
				function(orderItemsToDelete){ //should only be here if we have order items to delete
					var promise = Parse.Promise.as();
					_.each(orderItemsToDelete, function(orderItem,index,listOfItems){
						promise = promise.then(
							function(){
								// console.log("deleting order item with id " + orderItem.id + ", menuItemId of " + orderItem.get("menuItemId")+ "and quantity of " + orderItem.get("quantity"));
								return orderItem.destroy();
							}
						).then(null,function(error){
							console.log("error deleting order item : " + error.message);
							return Parse.Promise.error();
						});
					});
					return promise;
				}
			).then(
				function(){
					console.log("destroying order");
					return currentOrder.destroy();
				}
			).then(
				function(){
					console.log("orderingError : " + orderingError);
					if(orderingError.message == null)
						return response.error(orderingError);
					else if(orderingError.message == "Your card was declined.")
						return response.error(orderingError.message);
					else
						return response.error("Unknown error, please try again.");
						
				},
				function(error){
					return response.error(error);
				}
			);
		}
	)
});

/*
	Name :
	API Version :
	Parameters : 
	Returns : 
	Release notes :
 
*/
Parse.Cloud.beforeDelete("OrderItem",function(request,response){
	var orderItem = request.object;
	var userId;
	console.log("Delete Order Item Id: " + orderItem.id + " of menuItem : " + orderItem.get("menuItemId").id + " with quantity : " + orderItem.get("quantity"));


	var order = new Order();
	order.id = orderItem.get("orderId").id;

	var orderQuery = new Parse.Query(Order);
	orderQuery.include("locationId");

	Parse.Promise.as().then(
		function(){
			console.log("order query");
			console.log("order id : " + order.id);
			return orderQuery.get(order.id);
		}		
	).then(
		function(order){
			console.log("location id of order to delete : " + order.get("locationId").id);
			userId = order.get("userId").id;
			
			console.log("after query - order id of order item :" + order.id);
			var query = new Parse.Query("LocationItem");
			query.equalTo("locationId",order.get("locationId"));
			query.equalTo("menuItemId",orderItem.get("menuItemId"));
			return query.find();
		}
	).then(
		function(results){
			var locationItem = results[0];
			if(locationItem != null){ //if location item is null, that means an order was placed for an item not present at a location (this is different than being available, but sold out)
				var quantityBeforeAdjust = locationItem.get("quantity");
				var quantityOrdered = orderItem.get("quantity");
				//console.log("locationItem results, should be 1 : " + results.length);
				console.log("Changing quantity on locationItem from : " + quantityBeforeAdjust + " to : (" + quantityBeforeAdjust + " + " + quantityOrdered + ")");
				locationItem.increment("quantity",quantityOrdered);
				console.log("New locationItem quantity : " + locationItem.get("quantity") + " with id : " + locationItem.get("id"));
				locationItem.save().then(
					function(savedLocationItem){
						Mandrill.sendEmail(
							{
								message: {
									subject: "Parse:CC Failure",
									from_email:"parse@myrytebytes.com",
									text:"User : " + userId + "\n" +
										 "MenuItemId : " + orderItem.get("menuItemId").id + "\n" +
										 "LocationId : " + locationItem.get("locationId").id + "\n" +
										 "Quantity before adjustment : " + quantityBeforeAdjust + "\n" +
										 "Quantity ordered : " + quantityOrdered
									,
									to: [
										{
											email:"nick@myrytebytes.com",
											name:"Nick"
										}
									]
								},
								async:true
							},
							{
								success:function(httpResponse){},
								error:function(httpResponse){}
							}
						);

						response.success();
					}
				);
			}
			else {
				response.success();
			}	
		},
		function(error){
			console.log("Error in beforeDelete : " + error.message);
			response.error("Error finding order item with error : " + error.message);
		}
	);
});

/*
	Name :
	API Version :
	Parameters : 
	Returns : 
	Release notes :
 
*/
Parse.Cloud.define("updateuser",function(request,response){
	Parse.Cloud.useMasterKey();
	console.log("update user : " + request.params.userId);
	console.log("token : " + request.params.token);
	console.log("stripeId : " + request.params.stripeId);

	var query = new Parse.Query(Parse.User);
	Parse.Promise.as().then(
		function(){
			return query.get(request.params.userId);
		}
	).then(
		function(parseUser){
			console.log(request.params.token.substring(0,3));
			if(request.params.token.substring(0,3) == "tok") {//there was an error saving cc info to Stripe originally, so no customer object exists, now try and create with new data
				var customerRequestObject = {
					card : request.params.token,
					email : parseUser.get("email"),	
				}

				return Stripe.Customers.create(customerRequestObject)
				.then(
					function(stripeUser){
						console.log("Setting stripeId of " + stripeUser.id + " for userId : " + request.params.userId);
						parseUser.set("stripeId", stripeUser.id);
						return parseUser.save();
					}
				);
			}
			else {
				return Stripe.Customers.update(request.params.stripeId,{
					card : request.params.token
				});
			}
		}
	).then(
		function(stripeUser){
			console.log("successully updated stripe info for user : " + request.params.userId);
			return response.success("success");
		},
		function(error){
			var errorMsg = "Error saving credit card data - please check the values and try again.";
			if(error.message && error.message != ""){
				errorMsg = error.message;
			}
			console.log("error saving info in parse : " + error.message);
			return response.error(errorMsg);
		}
	);
});

/*
	Name :
	API Version :
	Parameters : 
	Returns : 
	Release notes :
 
*/
Parse.Cloud.define("userinfo",function(request,response){
	console.log("retrieve stripe info for user : " + request.params.userId);

	var query = new Parse.Query(Parse.User);
	Parse.Promise.as().then(
		function(){
			return query.get(request.params.userId);
		}
	).then(
		function(user){
			console.log("stripeId for user : " + user.get("stripeId"));
			return Stripe.Customers.retrieve(user.get("stripeId"));
		},
		function(error){
			console.log("error retrieving user : " + error.message);
			return error;
		}
	).then(
		function(stripeCustomer){
			response.success(stripeCustomer);
		},
		function(error){
			response.error("Error retrieving stripe information.");
		}
	);
});

/*
	Name :
	API Version :
	Parameters : 
	Returns : 
	Release notes :
 
*/
//Things to do:
	//1. Call Stripe to save customer data
	//2. Verify success
	//3. Query for user object & save with Stripe customer id
	//4. Return result to caller
Parse.Cloud.afterSave(Parse.User, function(request){
	var user = request.object;

	if(!user.existed()){
		console.log("Creating new stripe customer with email of : " + user.get("email"));
		console.log("User's token :" + user.get("stripeId"));

		var parseId = user.id;
		var stripeId = user.get("stripeId");

		var customerRequestObject = {
			card : stripeId,
			email : user.get("email"),	
		}

		Parse.Promise.as().then(function() {
			Stripe.Customers.create(customerRequestObject).then(
				function(customer){
					console.log("Created new customer object in Stripe with email: " + customer.email);
					console.log("stripe customer id : " + customer.id);
					return customer;
				},
				function(error){
					console.log("stripe customer save failed : " + error.message);
					return Parse.Promise.error("failed to save customer in Stripe");
				}
			).then(
				function(customer){
					//update user with stripe id here;
					console.log("Setting stripe id (" + customer.id + ") on customer with email (" + customer.email + ") + parseId : " + parseId);
					user.set("stripeId",customer.id);
					return user.save();
				}
			).then(
				function(newUser){
					console.log("updated stripeId to : " + newUser.get("stripeId") + " for user with email : " + newUser.get("email"));
				},
				function(error){
					console.log("error saving stripe info for user.");
				}
			);
		});
	}
});


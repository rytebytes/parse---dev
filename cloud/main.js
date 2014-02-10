
var Stripe = require ('stripe');
var _ = require('underscore');
var inventory = require('cloud/inventory_report.js');
var Mandrill = require('mandrill');

//Init Modules
Mandrill.initialize('KAszMl4utMaqTKy-ROWTcw');

// Stripe.initialize('sk_test_0eORjVUmVNJxwTHqMLLCogZr');
Stripe.initialize('sk_live_Bq60JoiLVW4UuubynRCqMFh4');

var LocationItem = Parse.Object.extend("LocationItem");
var Location = Parse.Object.extend("Location");
var MenuItem = Parse.Object.extend("MenuItem");
var OrderItem = Parse.Object.extend("OrderItem");
var Order = Parse.Object.extend("Order");
var User = Parse.Object.extend("User");

//This object has two properties
//  - message : a message to return to caller
//	- code : an error code specifying what happened so error handlers can react appropriately
//		- 01 - an item in the 
var OrderingError = Parse.Object.extend("OrderingError");


var STRIPE_ID = "stripe_id";

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

/*
Web Service to place an order. Requires an order object:
{
	userId : <User objectId>, 
	locationId : <Location objectId>,
	totalInCents: <order amount in USD cents>,
	orderItemDictionary:
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


	Parse.Promise.as().then(
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
			return Stripe.Charges.create({
					amount: request.params.totalInCents, //in cents
					currency: 'usd',
					customer: stripeId,
					description: 'Thanks for your purchase of RyteBytes! Remember to keep frozen until ready to heat!\n' +
								 'We donate 10% of our profits to your local food bank!' 
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
			console.log("saved order id : " + order.id);
			console.log("stripe purchase id : " + order.get("stripePurchaseId"));
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

//Update stripe info for user
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

//Return stripe customer info for user
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

	/*Parse.Promise.as().then(function() {
    // Find the item to purchase.
    var itemQuery = new Parse.Query('Item');
    itemQuery.equalTo('name', request.params.itemName);

    // Find the resuts. We handle the error here so our
    // handlers don't conflict when the error propagates.
    // Notice we do this for all asynchronous calls since we
    // want to handle the error differently each time.
    return itemQuery.first().then(null, function(error) {
      return Parse.Promise.error('Sorry, this item is no longer available.');
    });

  }).then(function(result) {
    // Make sure we found an item and that it's not out of stock.
    if (!result) {
      return Parse.Promise.error('Sorry, this item is no longer available.');
    } else if (result.get('quantityAvailable') <= 0) { // Cannot be 0
      return Parse.Promise.error('Sorry, this item is out of stock.');
    }

    // Decrease the quantity.
    item = result;
    item.increment('quantityAvailable', -1);

    // Save item.
    return item.save().then(null, function(error) {
      console.log('Decrementing quantity failed. Error: ' + error);
      return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
    });

  }).then(function(result) {
    // Make sure a concurrent request didn't take the last item.
    item = result;
    if (item.get('quantityAvailable') < 0) { // can be 0 if we took the last
      return Parse.Promise.error('Sorry, this item is out of stock.');
    }

    // We have items left! Let's create our order item before 
    // charging the credit card (just to be safe).
    order = new Parse.Object('Order');
    order.set('name', request.params.name);
    order.set('email', request.params.email);
    order.set('address', request.params.address);
    order.set('zip', request.params.zip);
    order.set('city_state', request.params.city);
    order.set('item', item);
    order.set('size', request.params.size || 'N/A');
    order.set('fulfilled', false);
    order.set('charged', false); // set to false until we actually charge the card

    // Create new order
    return order.save().then(null, function(error) {
      // This would be a good place to replenish the quantity we've removed.
      // We've ommited this step in this app.
      console.log('Creating order object failed. Error: ' + error);
      return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
    });

  }).then(function(order) { 
    // Now we can charge the credit card using Stripe and the credit card token.
    return Stripe.Charges.create({
      amount: item.get('price') * 100, // express dollars in cents 
      currency: 'usd',
      card: request.params.cardToken
    }).then(null, function(error) {
      console.log('Charging with stripe failed. Error: ' + error);
      return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
    });

  }).then(function(purchase) {
    // Credit card charged! Now we save the ID of the purchase on our
    // order and mark it as 'charged'.
    order.set('stripePaymentId', purchase.id);
    order.set('charged', true);

    // Save updated order
    return order.save().then(null, function(error) {
      // This is the worst place to fail since the card was charged but the order's
      // 'charged' field was not set. Here we need the user to contact us and give us
      // details of their credit card (last 4 digits) and we can then find the payment
      // on Stripe's dashboard to confirm which order to rectify. 
      return Parse.Promise.error('A critical error has occurred with your order. Please ' + 
                                 'contact store@parse.com at your earliest convinience. ');
    });

  }).then(function(order) {
    // Credit card charged and order item updated properly!
    // We're done, so let's send an email to the user.

    // Generate the email body string.
    var body = "We've received and processed your order for the following item: \n\n" +
               "Item: " + request.params.itemName + "\n";

    if (request.params.size && request.params.size !== "N/A") {
      body += "Size: " + request.params.size + "\n";
    }

    body += "\nPrice: $" + item.get('price') + ".00 \n" +
            "Shipping Address: \n" +
            request.params.name + "\n" +
            request.params.address + "\n" +
            request.params.city_state + "," +
            "United States, " + request.params.zip + "\n" +
            "\nWe will send your item as soon as possible. " + 
            "Let us know if you have any questions!\n\n" +
            "Thank you,\n" +
            "The Parse Team";

    // Send the email.
    return Mailgun.sendEmail({
      to: request.params.email,
      from: 'store@parse.com',
      subject: 'Your order for a Parse ' + request.params.itemName + ' was successful!',
      text: body
    }).then(null, function(error) {
      return Parse.Promise.error('Your purchase was successful, but we were not able to ' +
                                 'send you an email. Contact us at store@parse.com if ' +
                                 'you have any questions.');
    });

  }).then(function() {
    // And we're done!
    response.success('Success');

  // Any promise that throws an error will propagate to this handler.
  // We use it to return the error from our Cloud Function using the 
  // message we individually crafted based on the failure above.
  }, function(error) {
    response.error(error);
  });
*/
// });
			// var query = new Parse.Query(Parse.User);
			// query.get(parseId, {
			// 	success: function(userObject){
			// 		console.log("found user object with email : " + userObject.get("email"));
			// 		userObject.set("stripe_id", customer.id);
			// 		userObject.save().then(	
			// 			function(parseCustomer)
			// 			{
			// 				console.log("Successfully saved stripe id to user object.");
			// 				return response.success("successfully updated user with Stripe information.");
			// 			},
			// 			function(error)
			// 			{
			// 				console.log("Error saving stripe info to user object : " + error.message);
			// 				return Parse.Promise.error("error saving stripe data to user.");
			// 			}
			// 		);
			// 	},
			// 	error: function(object,error){
			// 		console.log("error retrieving user with id : " + parseId);
			// 		return Parse.Promise.error("error finding user with email (" + customer.email + ") and id (" + parseId + ")");
			// 	}
			// });
			// console.log("customer object propagated email : " + customer.email);


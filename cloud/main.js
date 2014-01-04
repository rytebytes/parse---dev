
var Stripe = require ('stripe');
var _ = require('underscore');
Stripe.initialize('sk_test_0eORjVUmVNJxwTHqMLLCogZr');

var LocationItem = Parse.Object.extend("LocationItem");
var Location = Parse.Object.extend("Location");
var MenuItem = Parse.Object.extend("MenuItem");
var OrderItem = Parse.Object.extend("OrderItem");
var Order = Parse.Object.extend("Order");
var User = Parse.Object.extend("User");

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
	var query = new Parse.Query("MenuItem");
	query.include("nutritionInfoId");
	query.find({
		success: function(results){
			return response.success(results);
		},
		error: function(error){
			return response.error(error);
		}
	});
});

Parse.Cloud.define("itemquantity", function(request,response){
	var query = new Parse.Query("LocationItem");
	query.equalTo("objectId",request.params.objectId);
	query.find({
		success: function(results){
			return response.success(results[0].get("quantity"));
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

	Parse.Promise.as().then(function(){
		return currentOrder.save();
	})
	.then(function() {	
		var promise = Parse.Promise.as();
		_.each(orderItems,function(quantityObject, menuItemId, list){
			
			/*
			This code does the following:
				1) look up the location item from the menu item & location passed in the order
				2) check the quantity for an item at a given location, if there's enough, decrement it by the order amount & save the LocationItem
				3) retrieve the menu item 
				4) create an order item
			*/

			promise = promise.then(
				function(){
					console.log("locationId : " + locationId);
					console.log("menuItemId : " + menuItemId);
					var menuItem = new MenuItem();
					menuItem.set("id", menuItemId);

					var query = new Parse.Query(LocationItem);
					query.equalTo("locationId",location);
					query.equalTo("menuItemId",menuItem);
					return query.find();
				}
			).then(
				function(results){
					console.log("results length should be 1 : " + results.length);
					console.log("quantity ordered : " + parseInt(quantityObject['quantity']));

					var quantity = parseInt(quantityObject['quantity']);

					if(results.length == 0){
						return Parse.Promise.error("error - no items found");
					}

					var item = results[0];

					if(item.get("quantity") < quantity){
						return Parse.Promise.error("No stock for item : " + item.get("menuItemId"));
					}
					item.increment("quantity",(-quantity));
					return item.save();
				}
			).then(
				function(locationItem){
					var menuItem = new MenuItem();
					menuItem.set("id",locationItem.get("menuItemId"));
					var query = new Parse.Query(MenuItem);
					return query.get(menuItemId);
				}
			).then(
				function(menuItem){
					console.log("menu item retireved with name :" + menuItem.get("name"));
					console.log("menu item with quantity : " + quantityObject['quantity']);
					var orderItem = new OrderItem();
					orderItem.set("menuItemId",menuItem);
					orderItem.set("quantity",parseInt(quantityObject['quantity']));
					orderItem.set("orderId",currentOrder);
					return orderItem.save();
				}
			);
		});
		return promise;
	}).then(
		function(){
			var query = new Parse.Query(Parse.User);
			return query.get(userId);
		}
	).then(
		function(userObject){
			stripeId = userObject.get("stripeId");
			return Stripe.Charges.create({
					amount: 10 * 100, //in cents
					currency: 'usd',
					customer: stripeId
			});
		},
		function(error){
			console.log("error retrieving user : " + error);
			return Parse.Promise.error("error finding user with id (" + userId + ")");
		}
	).then(
		function(purchase){
			console.log("purchase id : " + purchase.id);
			response.success("success");
		},
		function(error){
			console.log("Error sending charge request to Stripe :  " + error);
			return response.error(error);
		}
	);
});

	// });
	/*Parse.Promise.as().then(function() {
		return Stripe.Charges.create({
	      amount: 10 * 100, // express dollars in cents 
	      currency: 'usd',
	      card: request.params.cardToken
	    }).then(null, function(error) {
	      console.log('Charging with stripe failed. Error: ' + error);
	      return Parse.Promise.error('An error has occurred. Your credit card was not charged.');
	    });
    })*/

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

//Things to do:
	//1. Call Stripe to save customer data
	//2. Verify success
	//3. Query for user object & save with Stripe customer id
	//4. Return result to caller
Parse.Cloud.define("createuser", function(request,response){
	console.log("Created new customer with email of : " + request.params.email);
	console.log("User's Parse ID :" + request.params.id);

	var parseId = request.params.id;
	var stripeId;

	var customerRequestObject = {
		card : request.params.default_card,
		email : request.params.email,	
	}

	Parse.Promise.as().then(function() {
		Stripe.Customers.create(customerRequestObject).then(
			function(customer){
				console.log("Created new customer object in Stripe with email: " + customer.email);
				console.log("stripe customer id : " + customer.id);
				return customer;
			},
			function(error){
				console.log("stripe customer save failed : " + error);
				return Parse.Promise.error("failed to save customer in Stripe");
			}
		).then(function(customer){
			//update user with stripe id here;
			console.log("Setting stripe id (" + customer.id + ") on customer with email (" + customer.email + ") + parseId : " + parseId);
			var query = new Parse.Query(Parse.User);
			query.get(parseId, {
				success: function(userObject){
					console.log("found user object with email : " + userObject.get("email"));
					userObject.set("stripe_id", customer.id);
					userObject.save().then(	
						function(parseCustomer)
						{
							console.log("Successfully saved stripe id to user object.");
							return response.success("successfully updated user with Stripe information.");
						},
						function(error)
						{
							console.log("Error saving stripe info to user object : " + error.message);
							return Parse.Promise.error("error saving stripe data to user.");
						}
					);
				},
				error: function(object,error){
					console.log("error retrieving user with id : " + parseId);
					return Parse.Promise.error("error finding user with email (" + customer.email + ") and id (" + parseId + ")");
				}
			});
			console.log("customer object propagated email : " + customer.email);
		});
	});
});

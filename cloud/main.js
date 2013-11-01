
var Stripe = require ('stripe');
Stripe.initialize('sk_test_0eORjVUmVNJxwTHqMLLCogZr');

var STRIPE_ID = "stripe_id";

/*
Web Service to place an order. Requires the following json structure:
{
	userId : <parse user id>, (String)
	pickupId : <location id>, (String)
	orderItems : { (Dictionary)
		<menu item id> = <quantity>
	},
	couponId : <coupon id> (String)
}

*/
Parse.Cloud.define("order", function(request,response){
	console.log("received order : " + request);

	var query = new Parse.Query(Parse.User);
	var stripeId;
	query.get(request.params.userId, {
		success: function(userObject){
			console.log("found user object with email : " + userObject.get("email"));
			stripeId = userObject.get("stripe_id");
			console.log("stripe_id : " + stripeId);

			return Parse.Promise.as().then(function(){
					return Stripe.Charges.create({
						amount: 10 * 100, //in cents
						currency: 'usd',
						customer: stripeId
					}).then(null, function(error){
						console.log("Error sending charge request to Stripe :  " + error);
						return Parse.Promise.error("error");
					});
			}).then(function(purchase) {
				console.log("purchase id : " + purchase.id);
				response.success("success");
			});
		},
		error: function(object,error){
			console.log("error retrieving user with id : " + parseId);
			return Parse.Promise.error("error finding user with email (" + customer.email + ") and id (" + parseId + ")");
		}
	});
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
});

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

/*


*/
Parse.Cloud.define("retrievemenu", function(request,response){
	// console.log("sending updated menu");
	response.success(
	[
	    {   
	        "name" : "The Founders Favorite",
	        "long_description":"Our favorite meal to make when pressed for time - a delcious bone-in pork chop, roasted summer-fresh broccoli, and the broiled red potatoes tossed with fresh herbs and olive oil.",
	        "price":"13",
	        "type":"3",
	        "picture":"images/missing_menu.png",
	        "uid" : "1",
	        "nutrition_info" : {
	            "calories" : "600",
	            "protein" : "40",
	            "carbs" : "30"
	        }
	    },
	    {   
	        "name" : "Mob Meal I",     
	        "long_description":"A meal that will remind your of spaghetti & meatballs.  Whole-wheat linguine is tossed in our home-made gravy (what the old time Italians call tomato sauce) based on a recipe from one of our italian grandmothers.  A trio of delicious italian sausage meatballs round out the meal!",
	        "price":"10",
	        "picture":"mob.JPG",
	        "uid" : "2",
	        "nutrition_info" : {
	            "calories" : "600",
	            "protein" : "40",
	            "carbs" : "30"
	        }
	    },
	    {   
	        "name" : "Mob Meal II",
	        "long_description":"The same deliciousness of the original mob meal made with turkey for a leaner meatball.  All the fun with a fraction of the fat - what more could you ask for?!",
	        "price":"13",
	        "picture":"images/mob_meal_two.png",
	        "uid" : "3",
	        "nutrition_info" : {
	            "calories" : "600",
	            "protein" : "40",
	            "carbs" : "30"
	        }
	    },
	    {   
	        "name" : "RyteBytes Recommended",
	        "long_description":"Enjoy our ideal home cooked meal, without worrying about the cooking!  A perfectly grilled BBQ chicken breast, broiled red potatoes tossed in fresh herbs with roasted beets & carrots - healthy comfort food.",
	        "price":"13",
	        "picture":"images/chick_beets_taters.png",
	        "uid" : "4",
	        "nutrition_info" : {
	            "calories" : "600",
	            "protein" : "40",
	            "carbs" : "30"
	        }
	    },
	    {   
	        "name" : "The Fred Flintrock",
	        "short_description":"Same deliciousness as the original Mob Meal, 95% less fat - what could be better?",
	        "long_description":"Our paleo focused meal combines lean protein with two servings of vegetables.  Our delicious BBQ chicken, served alongside the roasted broccoli and the beets and carrots.  Cave men never ate this good!",
	        "price":"13",
	        "picture":"images/missing_menu.png",
	        "uid" : "5",
	        "nutrition_info" : {
	            "calories" : "600",
	            "protein" : "40",
	            "carbs" : "30"
	        }
	    }
	]);
});

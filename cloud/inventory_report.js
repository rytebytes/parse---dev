//Modules Needed
var Mandrill = require('mandrill');
var moment = require('moment');

//Init Modules
Mandrill.initialize('KAszMl4utMaqTKy-ROWTcw');

//Object declarations
var LocationItem = Parse.Object.extend("LocationItem");
var Location = Parse.Object.extend("Location");

//Jobs
Parse.Cloud.job("inventory_report",function (request,status) {

	var emailSummary = "";

	var locationSummary = " Location : {0} \n Date : {1} \n";

	var LocationCollection = Parse.Collection.extend({
		model:Location
	});

	var LocationItemCollection = Parse.Collection.extend({
		model:LocationItem
	});

	var locations = new LocationCollection();

	locations.fetch({
		success: function(allLocations){
			allLocations.each(function(location){
				console.log("location name : " + location.name);

				var query = new Parse.Query("LocationItem");
				query.equalTo("locationId",location);
				query.include("menuItemId");

				var locationItemCollection = query.collection();

				locationItemCollection.each(function(locationItem){
					console.log("location item name : " + locationItem.menuItemId.name);
					console.log("location item quant : " + locationItem.quantity);
					locationSummary += String.format("{0} : {1} \n", locationItem.menuItemId.name, locationItem.quantity);
				});

				emailSummary += String.format(locationSummary,location.name,moment.moment());
			});
		},
		error: function(allLocations,error){

		}
	});

	console.log("email summary " + emailSummary);
	status.success();	
});

String.format = function() {
  var s = arguments[0];
  for (var i = 0; i < arguments.length - 1; i++) {       
    var reg = new RegExp("\\{" + i + "\\}", "gm");             
    s = s.replace(reg, arguments[i + 1]);
  }

  return s;
}
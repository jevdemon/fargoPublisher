//Copyright 2014, Small Picture, Inc.
	//Last update: 1/21/2014; 10:47:28 PM

var s3path = "/tmp.scripting.com/blog"; //where we store all the files we create
var s3defaultType = "text/plain";
var s3defaultAcl = "public-read";
var myTableName = "smallpictcom";
var myDomain = "smallpict.com";

var http = require ("http");
var request = require ("request");
var urlpack = require ("url");
var AWS = require ("aws-sdk");
var s3 = new AWS.S3 ();
var db = new AWS.DynamoDB ();

var httpReadUrl = function (url, callback) {
	request (url, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			callback (body) 
			}
		});
	
	}
var writeStaticFile = function (path, data, type, acl) {
	var bucketname = "";
	if (type == undefined) {
		type = s3defaultType;
		}
	if (acl == undefined) {
		acl = s3defaultAcl;
		}
	
	//split path into bucketname and path -- like this: /tmp.scripting.com/testing/one.txt
		if (path.length > 0) {
			if (path [0] == "/") { //delete the slash
				path = path.substr (1); 
				}
			var ix = path.indexOf ("/");
			bucketname = path.substr (0, ix);
			path = path.substr (ix + 1);
			}
	
	var params = {
		ACL: acl,
		ContentType: type,
		Body: data,
		Bucket: bucketname,
		Key: path
		};
	s3.putObject (params, function (err, data) { 
		console.log ("Wrote: http://" + bucketname + "/" + path);
		});
	}
var getNameRecord = function (recordkey, callback) { //if looking up dave.smallpict.com info, recordkey == dave
	var params = {
		TableName: myTableName,
		AttributesToGet: [
			"opmlUrl", "packageUrl", "whenCreated"
			],
		Key: {
			name: {"S": recordkey}
			}
		}
	db.getItem (params, function (err, data) {
		callback (data);
		});
	}
var isNameDefined = function (recordkey, callback) {
	getNameRecord (recordkey, function (data) {
		callback (data.Item != undefined);
		});
	}
var padWithZeros = function (num, ctplaces) {
	var s = num.toString ();
	while (s.length < ctplaces) {
		s = "0" + s;
		}
	return (s);
	}
var isAlpha = function (ch) {
	return (((ch >= 'a') && (ch <= 'z')) || ((ch >= 'A') && (ch <= 'Z')));
	}
var scrapeTagValue = function (sourcestring, tagname) {
	var s = sourcestring; //work with a copy
	var opentag = "<" + tagname + ">", closetag = "</" + tagname + ">";
	var ix = s.indexOf (opentag);
	if (ix >= 0) {
		s = s.substr (ix + opentag.length);
		ix = s.indexOf (closetag);
		if (ix >= 0) {
			s = s.substr (0, ix);
			return (s);
			}
		}
	return ("");
	}
function parsePackages (s) {
	var magicpattern = "<[{~#--- ", ix, path, htmltext;
	while (s.length > 0) {
		ix = s.indexOf (magicpattern);
		if (ix < 0) {
			break;
			}
		s = s.substr (ix + magicpattern.length);
		ix = s.indexOf ("\n");
		path = s.substr (0, ix);
		s = s.substr (ix + 1);
		ix = s.indexOf (magicpattern);
		if (ix < 0) {
			htmltext = s;
			}
		else {
			htmltext = s.substr (0, ix);
			s = s.substr (ix);
			}
		console.log ("\"" + path + "\" == " + htmltext.length + " characters.");
		writeStaticFile (s3path + path, htmltext, "text/html");
		}
	}
var handlePackagePing = function (urloutline) {
	console.log ("handlePackagePing: " + urloutline);
	httpReadUrl (urloutline, function (httptext) {
		var urlpackage = scrapeTagValue (httptext, "linkHosting");
		console.log ("package url: " + urlpackage);
		httpReadUrl (urlpackage, function (packagetext) {
			console.log ("package text: " + packagetext.length + " chars.");
			parsePackages (packagetext);
			});
		});
	}

console.log ("starting server");
var counter = 0;
var server = http.createServer (function (request, response) {
	console.log (request.url);
	
	var parsedUrl = urlpack.parse (request.url, true);
	
	switch (parsedUrl.pathname.toLowerCase ()) {
		case "/pingpackage":
			response.writeHead (200, {"Content-Type": "application/json"});
			
			handlePackagePing (parsedUrl.query.link);
			
			var x = {"url": parsedUrl.query.link};
			var s = "getData (" + JSON.stringify (x) + ")";
			response.end (s);    
			
			break;
		case "/isnameavailable":
			var name = parsedUrl.query.name;
			
			response.writeHead (200, {"Content-Type": "text/html"});
			
			if (name.length == 0) {
				response.end ("");    
				}
			else {
				if (name.length < 4) {
					response.end ("Name must be 4 or more characters.");
					}
				else {
					isNameDefined (name, function (fldefined) {
						var color, answer;
						if (fldefined) {
							color = "red";
							answer = "is not";
							}
						else {
							color = "green";
							answer = "is";
							}
						response.end ("<span style=\"color: " + color + ";\">" + name + "." + myDomain + " " + answer + " available.</span>")
						});
					}
				}
			
			break
		default:
			response.writeHead (404, {"Content-Type": "text/plain"});
			response.end ("404 Not Found");
			break;
		}
	});
server.listen (1337);
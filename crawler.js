//--- MODULES ---
var express = require('express');
var app = express.createServer();
var HTMLParser = require('cheerio');

//--- META ---
var front_location = '/front';
app.set('views', __dirname + front_location);
app.use(express.static(__dirname + front_location));
app.set('view engine', 'jade');
app.use(express.bodyParser());

//--- GLOBAL VARS ---

var current_layer;
var crawl_depth;
var layer_lengths;
var urls_found;
var meta_found;
var url_parent_track;
var just_primary_site;
var url_assets;
var assets_to_collect;


var inital_render = function(req,res){
	res.render('layout');
}

//--- CONTROLLERS: The crawling! ---
var valid_request_data = function(url,crawl_depth){

	//Check URL with regex
	var errors = [];
	var reg_expression = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi;
	var regex = new RegExp(reg_expression);
	if(url.match(regex) == null) {
		errors.push("Invalid URL.");
	}

	//Check type and range of crawl depth is valid
	if(isNaN(crawl_depth)){
		errors.push("Invalid crawl depth.");
	}else if(parseInt(crawl_depth) < 1){
		errors.push("Crawl depth too low.");
	}

	return errors;

}

var initiate_crawl = function(req,res){

	//Receive request meta data
	var url = req.body.url;
	crawl_depth = req.body.crawl_depth;
	assets_to_collect = ["linkers", "images", "scripts"];
	just_primary_site = 0;//req.just_primary_site;


	//Break if invalid requests
	var errors = valid_request_data(url,crawl_depth); 
	if(errors.length == 0){
		crawl_depth = parseInt(crawl_depth);

		var crawl_count = crawl_depth;
		url = (url[url.length-1] != "/") ? url += "/" : url; //Confirm there is a trailing slash after URL 
		var http_module = get_http_module(url);  

		//Setup primary URL as first to crawl
		urls_found = [url]; 
		urls_meta = [{layer: 0, parent: '', id: 0}];

		//Prepare crawl
		url_parent_track = [];
		url_assets = [];
		layer_lengths = [1];
		current_layer = 1;
		var i = 0;
		var tracker = 0;
		continue_crawl(i, res);
	
	}else{
		send_response(res, errors);
	}

}

var continue_crawl = function(i, res){
	if(urls_found.length > i){ //If no more URLs to crawl
		if(urls_found[i].substring(0,4) == "http"){ //
			scan_body(urls_found[i], function(url_batch, url_batch_meta){
				console.log(url_batch);
				i ++;
				var total_layer_lengths = 0;
				for(var ll in layer_lengths){
					total_layer_lengths += layer_lengths[ll]; //Get sum of layer lengths
				}

				if(i == total_layer_lengths){//If crawler reached end of layer, prepare to go deeper
					layer_lengths.push(url_batch.length);
					current_layer ++;
				}

				//Add new batch to rest of URLs
				urls_found = urls_found.concat(url_batch);
				urls_meta = urls_meta.concat(url_batch_meta);
				
				if(current_layer <= crawl_depth){
					continue_crawl(i, res); //If maximum depth not exceeded, recursively continue crawl
				}else{
					send_response(res,[]);
				}
			});
		}else if(current_layer <= crawl_depth){
			i ++;
			continue_crawl(i, res);
		}
	}else{
		send_response(res,[]);
	}
}



var scan_body = function(url, callback){
	var http_module = get_http_module(url);
	var links = [];
	var meta = [];
	if(url.indexOf(urls_found[0]) == -1 && just_primary_site == 1){ //Keep crawling only on primary site, if needed
		
		callback(links, meta);
	}else{

		get_url_body(url, http_module, function(html_body){
			url_parent_track.push(url); //Keep record of url parents
			var parent_id = url_parent_track.length-1;
			var DOM = HTMLParser.load(html_body); //HTML string to dynamic DOM
			var dlinks = DOM("a");

			var single_url_assets = {url: parent_id};
			//Get all assets
			for(var asset in assets_to_collect){
				single_url_assets[assets_to_collect[asset]] = retrieve_page_assets(DOM, assets_to_collect[asset]);
			}

			url_assets.push(single_url_assets);
			
		    for(var link in dlinks){

		    	var href = DOM(dlinks[link]).attr("href"); //Get raw URL from DOM

		    	if(href == undefined){
		    		break;
		    	}
		    	if(href.substring(0,1) == "/"){
					var pos_of_main_url_end = url.indexOf("/", 8);
					var pre_url = url.substring(0,pos_of_main_url_end);
					href = pre_url + href;
				}
		    	if(valid_link_for_crawl(href, links)){ //Add single url data to URL batch

		    		links.push(href);
		    		meta.push({layer: current_layer, parent: parent_id});
		    	}
		    	
		    }

		    callback(links, meta);

		 });
	}
}

var get_list_of_vals_from_DOM = function(DOM, element_name, attr_name){ //Get values of attributes of HTML elements
	var list = [];
	var dlist = DOM(element_name);
	for(var i in dlist){ 
		if(dlist[i].name == element_name){
			var a_url = DOM(dlist[i]).attr(attr_name);
			if(a_url != undefined){
				list.push(a_url);
			}
		}
	}
	return list;
}

var retrieve_page_assets = function(DOM, asset){
	var attr_name;
	var element_name;
	switch(asset){ //Determine where assets are represented by elements
		case "linkers":
			element_name = "link";
			attr_name = "href";
		break;
		case "images":
			element_name = "img";
			attr_name = "src";
		break;
		case "scripts":
			element_name = "script";
			attr_name = "src";
		break;
	}

	return get_list_of_vals_from_DOM(DOM, element_name, attr_name);
}


var valid_link_for_crawl = function(string,links){
	
	if( /\d/.test(string) == false  && 
	 urls_found.indexOf(string) == -1 && //Confirm URL isn't repeated in previous crawls
	 links.indexOf(string) == -1 &&  //Confirm URL isn't repeated in current URL batch
	 string.substring(0,1) != "#" ){ //Confirm link is not a local jump-to link
		return true;
	}else{
		return false;
	}
}

var send_response = function(res,errors){
	var success = false;
	var final_data;
	if(errors.length > 0){
		final_data = errors;
	}else if(urls_found.length == 1){
		final_data = ["Nothing found. Make sure you specified the URL with the correct HTTP protocol, or included www(.) if needed."];
	}else{
		success = true;
		final_data = process_url_data(urls_meta, urls_found);
	}
	console.log(errors);
	res.send({success: success, data: final_data});
}

var process_url_data = function(urls_meta, urls_found){
	for(var v in urls_meta){
		if(urls_found[v].substring(0,1) == "/"){ //If incomplete URL, generate full URL
			var parent_url = url_parent_track[urls_meta[v].parent];
			var pos_of_main_url_end = parent_url.indexOf("/", 8);
			var pre_url = parent_url.substring(0,pos_of_main_url_end);
			urls_found[v] = pre_url + urls_found[v];

		}

		urls_meta[v].link = urls_found[v];
	}
	return {urls: urls_meta, parents: url_parent_track, assets: url_assets}; //Collect all data
}

var get_url_body = function(url,http_module,callback){

	var html_body = "";

	require(http_module).get(url, function(url_res){

		url_res.setEncoding('utf8');

		url_res.on('error', function(err){ //Debug error listener  
			console.log(err);
		}); 

		url_res.on('data', function(part){ //Get each part of response and concatenate to complete body value
			html_body += part;
		});
		url_res.on('end', function(){ //Respond with callback
			callback(html_body);
		});

	});
}

var get_http_module = function(url){
	return (url[4] == "s") ? 'https' : 'http'; //Interchange http modules depending on security of URL
}

//--- ROUTES ---
app.get('/',inital_render);
app.post('/crawl', initiate_crawl);

//--- LISTEN PORT ---
app.listen(3000, function () {
  console.log('Listening');
});

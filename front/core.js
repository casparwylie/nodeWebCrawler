$(document).ready(function(){

	// --- GLOBAL / CONSTANTS --
	var loading_msg_speed = 333;
	var urls;
	var parents;
	var assets;

	//crawl request event handler
	$("#crawl_submit").click(function(){

		//Collect form values
		var url = $("#url_input").val();
		var crawl_depth = $("#crawl_depth_input").val();

		//Setup UX for loading
		$("#loading_msg").html("Crawling...");
		$("#loading_msg,#back").fadeIn(loading_msg_speed);
		var loading_interval = setInterval(function(){
			$("#loading_msg").fadeOut(loading_msg_speed).fadeIn(loading_msg_speed);
		}, loading_msg_speed*3);
		$("#main_container").fadeOut(100);
		
		//Make POST request with form values
		$.post("/crawl", {url: url, crawl_depth: crawl_depth}, function(result){
			clearInterval(loading_interval);
			
			if(result.success == false){
				$("#loading_msg").html(result.data.join("<br>")); //Show errors if exist
				$("#loading_msg").show();
			}else{
				clearInterval(loading_interval);
				$("#loading_msg").fadeOut(250);
				$("#loading_msg").html("");
				//Setup response data
				urls = result.data.urls;
				parents = result.data.parents;
				assets = result.data.assets;

				//Configuration for chart
				var chart_nodes = [];
			    var config = {
			        container: "#chart_container",
			        siblingSeparation: 20,
			        levelSeparation: 100,
			        connectors: {
			            type: 'curve'
			        },
			        node: {
			            HTMLclass: 'chart_node'
			        }
			    }

			    //Add config
		   		chart_nodes.push(config);
		   		chart_nodes.push({
		   			text:{
		   				data_link: urls[0].link
		   			}
		   		});


		   		function get_parent_from_chart(id){
		   			var parent_name = parents[id];
		   			
		   			for(var i in chart_nodes){
		   				if( i != 0){
			   				if(chart_nodes[i].text.data_link == parent_name){
			   					return chart_nodes[i];
			   					break;
			   				}
			   			}	
		   			}
		   		}

		   		//Populate chart nodes with organised data
		   		for(var i in urls){
		   			var value = urls[i].link;
		   			var id = -1;
		   			var parent_pos = parents.indexOf(value);
		   			var node = {
		   				parent: get_parent_from_chart(urls[i].parent),
		   				text: {data_link: urls[i].link},
		   				innerHTML:"<div class = 'chart_inner_node' id = '"+parent_pos+"' value = '"+value+"'> </div>"//urls[i].link
		   				
		   			};
		   			chart_nodes.push(node);
		   		}

		   		//Show chart
		   		var chart = new Treant(chart_nodes);
		   		setTimeout(function(){
		   			$("#chart_container").fadeIn(100);
		   		}, 1000);

			}
		});
	});

	//Keep url field valid
	var pre_url = ["http://", "https://"];
	$("#url_input").keyup(function(){
		var val = $(this).val();
		if((val.substring(0,7) != pre_url[0]) && (val.substring(0,8) != pre_url[1])){
			$(this).val(pre_url[0]);
		}
	}).focus(function(){
		if($(this).val().length == 0){
			$(this).val(pre_url[0]);
		}
	});

	//Change UX for going back to form
	$("#back").click(function(){
		$(this).fadeOut(100);
		$("#chart_container").fadeOut(100);
		$("#main_container").fadeIn(100);
		$("#loading_msg").hide();
	});

	//Event for viewing node data
	$("body").on("mouseover",".chart_node", function(e){
		$("#node_label").show();
		$("#node_label").css("margin-left", e.pageX );
		$("#node_label").css("margin-top", e.pageY );
		var inner_node = $(this).children(".chart_inner_node");
		var spec_asset;
		var parent_pos = inner_node.attr("id");
		if(parent_pos != -1){ //Get assets if avaliable 
			for(var i in assets){
				if(assets[i].url == parent_pos){
					spec_asset = assets[i];
					break;
				}
			}
		}
		
		//Construct html of assets to view
		function label_html(label){
			return "<span style = 'color: dimgrey'>" + label + ": </span>";
		}
		var url_value = label_html("URL") + inner_node.attr("value") + "<br>";
		var scripts = "";
		var linkers = "";
		var images = "";
		if(spec_asset != undefined){
			scripts = (spec_asset.scripts.length > 0)? label_html("<br>SCRIPTS") + spec_asset.scripts.join("<br>") +  "<br>" : "";
			linkers = (spec_asset.linkers.length > 0)? label_html("<br>LINKERS") + spec_asset.linkers.join("<br>") +  "<br>": "";
			images = (spec_asset.images.length > 0)? label_html("<br>IMAGES") + spec_asset.images.join("<br>") +  "<br>": "";
		}else{
			scripts = "<br><br>NO ASSETS: THE URLS ON FINAL LAYER DO NOT GET CRAWLED!";
		}

		//Show node data
		var whole_label = url_value + scripts + linkers + images;
		$("#node_label").html(whole_label);
		var to_height = $("#node_label")[0].scrollHeight.toString() + 'px';
		$("#node_label").animate({height: to_height}, 100);
	}).on("mouseleave",".chart_node", function(e){
		$("#node_label").animate({height:  "0px"}, 0);
		$("#node_label").hide();
	});

});
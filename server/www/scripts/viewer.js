var game_rounds = [];
var gamble_number = false;

var game_websockets = new WebSocket('ws://192.168.1.170:8080');

game_websockets.onopen = function(e) {
	/* On successful connection to server, get the client list */
	send_socket_request("get_client_list");	
};

game_websockets.onmessage = function(event) {
	
	console.log("Message received: "+event.data);
	var received_JSON = JSON.parse(event.data);

	/* We're only looking for broadcasts here since this is only a viewer */
	// Parse received data based on original request
	switch(received_JSON["request"]) {
		case "broadcast":
			$(".player").css("background-color", "");
			switch(received_JSON["message"]) {
				case "reset":
					/* Game as just been reset, let's reload client table */
					send_socket_request("get_client_list");
					/* Clear the board */
					for(i=1; i<10; i++) {
						$("#cell_"+i).html("");
					}
					gamble_number = false;
					$(".squares_cell").css("background-color", "");
					break;
				case "client_list_change":
					/* Client list has changed */
					send_socket_request("get_client_list");
					break;
				case "board_shuffle":
					/* Shuffle the board around */
					$(".squares_cell").css("background-color", "");
					game_rounds = [];
					game_rounds_i = 0;
					$(received_JSON["data"]).each(function(i) {
						game_rounds[game_rounds_i] = received_JSON["data"][i];
						game_rounds_i++;
					});

					var add_gamble = false;
					gamble_number = false;
					for(i=1; i<10; i++) {
						$("#cell_"+i).html(function(){
							if(( (1 + Math.floor(Math.random() * 18)) == (1 + Math.floor(Math.random() * 18)) ) && ((!add_gamble)))
							{
								add_gamble = true;
								gamble_number = i;
								send_socket_request("broadcast_gamble_id", {"gamble_id": game_rounds[i]["round_id"]});
								return "<span style=\"font-style:italic;color:#9b2529\">Gamble</span>"
							} else {
								if(game_rounds[i]["round_en"]) {
									return game_rounds[i]["round_name"];
								} else {
									return "<span style=\"color:#db975c\">"+game_rounds[i]["round_name"]+"</span>"
								}
							}
						});
					}
					break;
				case "board_randomise":
					var probability = 7;
					(function squares_loop(prev=11) {
						setTimeout(function() {
							do {
								var number = 1 + Math.floor(Math.random() * 9);
							} while(number == prev)
							$(".squares_cell").css("background-color", "");
							$("#cell_"+number).css("background-color", "#dd4b1f");
							var random = [(1 + Math.floor(Math.random() * probability)), (1 + Math.floor(Math.random() * probability))]
							if( random[0] != random[1] ) {
								/* We haven't landed on the correct random number yet */
								squares_loop(number);
							} else {
								/* Finished, let's see if that round's available */
								if((game_rounds[number]["round_en"]) || (number == gamble_number)) {
									/* Round still has questions available */
									if(number == gamble_number) {
										send_socket_request("broadcast_board_randomise_result", {"round": "Gamble"});
										round_flash(number, true);
									} else {
										send_socket_request("broadcast_board_randomise_result", {"round": game_rounds[number]["round_name"]});
										round_flash(number, false);
									}
								} else {
									/* No more question left, keep looking and reduce probability*/
									if(probability > 2) probability -= 2;
									squares_loop(number);
								}
							}
						}, 250)
					})();
					break;
				case "player_name_change":
					if(received_JSON["data"]['player_name'] != "") {
						$('#player_name_'+received_JSON["data"]['client_id']).html(received_JSON["data"]['player_name']);
					}
					break;
				case "player_score_change":
					/* Player's score has changed */
					$("#player_score_"+received_JSON["data"]["client_id"]).html(received_JSON["data"]["player_score"]);
					break;
				case "buzz_in":
					(function winner_flash_loop(i) {
						setTimeout(function() {
							if(i%2) {
								$("#player_row_"+received_JSON["data"]["client_id"]).css("background-color", "#dd1f1f");
							} else {
								$("#player_row_"+received_JSON["data"]["client_id"]).css("background-color", "");
							}
							if(--i) {
								winner_flash_loop(i)
							}
						}, 200)
					})(15);
					break;
			}
			break;
		case "get_client_list":
			if(received_JSON["status"] == "0") {
				draw_score_board(received_JSON["result"]);
			} else {
				// Error getting Client List
				console.log("Error getting Client List");
				console.log(received_JSON);
			}
			break;
	}
};

game_websockets.onclose = function(event) {
	if (event.wasClean) {
		console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
	} else {
		// e.g. server process killed or network down
		// event.code is usually 1006 in this case
		console.log('[close] Connection died');
	}
};

game_websockets.onerror = function(error) {
	console.log(`[error] ${error.message}`);
};

function send_socket_request(request, data) {
	var send_str = {"request": request, "client_id": "0", "data": data};
	game_websockets.send(JSON.stringify(send_str));
}

function draw_score_board(players) {
	/* Clear current client table */ 
	$("#scores").html("");

	$(players).each(function(i) {
		player = players[i];
		if(player["client_id"] != 1) {

			$('<div/>', {
				id: 'player_row_'+player['client_id'],
				"client_id": player['client_id'],
				"class": 'player',
			}).appendTo('#scores');

			/* Add the player's name, or their colour if they have no name */
			if((player['player_name'] == null) || (player['player_name'] == "")) {
				var player_name_show = "<span style=\"color: "+translated_client_colour(player['client_colour'])+"; text-transform:capitalize;\">"+translated_client_colour(player['client_colour'])+"</span>";
			} else {
				var player_name_show = player['player_name'];
			}
			$('<div/>', {
				"id": 'player_name_'+player['client_id'],
				"class": 'player_name',
				html: player_name_show
			}).appendTo('#player_row_'+player['client_id']);

			/* Add the player's score */
			$('<div/>', {
				"id": 'player_score_'+player['client_id'],
				"class": 'player_score',
				html: player['player_score']
			}).appendTo('#player_row_'+player['client_id']);
		}
	});
}

function translated_client_colour(colour) {
	switch (colour) {
		case 'r': return "red"; break;
		case 'b': return "blue"; break;
		case 'g': return "green"; break;
		case 'y': return "yellow"; break;
		case 'w': return "white"; break;
	}
}

function round_flash(number, gamble) {
	(function round_flash_loop(i, number, gamble) {
		if(gamble) var flash_element = ".squares_cell";
		else var flash_element = "#cell_"+number;
		setTimeout(function() {
			if(i%2) {
				$(flash_element).css("background-color", "#dd1f1f");
			} else {
				$(flash_element).css("background-color", "#dd4b1f");
			}
			if(--i) {
				round_flash_loop(i, number, gamble)
			} else {
				$(".squares_cell").css("background-color", "#dd781f");
				$("#cell_"+number).css("background-color", "#dd1f1f");
			}

		}, 100)
	})(15, number, gamble);
}
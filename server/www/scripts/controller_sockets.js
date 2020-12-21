var game_websockets = new WebSocket('ws://192.168.1.170:8080');

game_websockets.onopen = function(e) {
	/* On successful connection to server, get the admin data and client list */
	send_socket_request("get_admin_data");
	/* Get the list of rounds */
	send_socket_request("get_rounds");
};

game_websockets.onmessage = function(event) {
	
	console.log("Message received: "+event.data);
	var received_JSON = JSON.parse(event.data);

	// Parse received data based on original request
	switch(received_JSON["request"]) {
		case "broadcast":
			// Broadcast message received, we should handle this a bit differently
			game_parse_broadcast(received_JSON);
			break;
		case "get_client_list":
			if(received_JSON["status"] == "0") {
				updateClientList(received_JSON["result"])
			} else {
				// Error getting Client List
				console.log("Error getting Client List");
				console.log(received_JSON);
			}
			break;
		case "update_player_name":
			if(received_JSON["status"] != "0") {
				$("#game_status").html("<span style=\"font-style: italic; color: #f00\">Error setting player name</span>");
			}
			break;
		case "get_admin_data":
			if(received_JSON["status"] == "0") {
				/* Store current game data to compare */
				var current_game_in_progress = game_in_progress;
				var current_game_state = game_state;
				
				var game_data = received_JSON["result"]
				/* Copy the data into our local variables */
				game_in_progress = game_data['game_in_progress'];
				game_state = game_data['game_state'];
				/* Now see if anything's updated */
				if((current_game_in_progress != game_in_progress) || (current_game_state != game_state)) {
					/* Update client list */
					send_socket_request("get_client_list");
					/* Update game start stop button */
					update_game_button();
					/* Update round start stop button */
					update_round_button();
					/* Update game status text */
					update_game_status();
					/* Set game reset button */
					$("#control_reset_game").html("Reset Game");
					/* Update game status */
					if(game_reset) {
						game_reset = false;
						$("#game_status").html("Game Reset");
					} else {
						//update_game_status();
					}
				}
			} else {
				// Error getting Client List
				console.log("Error getting Game Admin Data");
			}
			break;
		case "get_rounds":
			if(received_JSON["status"] == "0") {
				var rounds = received_JSON["result"];
				
				game_rounds = [];
				var index = 0;
				$(rounds).each(function(i) {
					game_rounds[index] = ({"round_id": rounds[i]["round_id"], "round_name": rounds[i]["round_name"], "round_en": rounds[i]["round_en"]});
					index++;
				});
				updateRoundsList();
			} else {
				// Error getting Rounds
				console.log("Error getting rounds");
			}
			break;
		default:
			//Error in received data
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
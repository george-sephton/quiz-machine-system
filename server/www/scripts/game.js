/* Game admin data */
var game_in_progress;
var game_state;
var game_reset = false;

var winning_row = false;

var buzz_sounds = [
	[1, "Buzz"],
	[2, "Triumph"],
	[3, "Oboe"],
	[4, "Sad Trumpet"],
	[5, "Sneeze"],
	[6, "Baby"],
	[7, "Cartoon"],
	[8, "Shimmer"],
	[9, "Lasers"],
	[10, "Nokia"],
	[11, "Oriental"],
	[12, "Slap"],
	[13, "Santa"],
	[14, "Jingle Bells"],
	[15, "Squeaker"],
	[16, "Duck"]
];

function loadSoundsPreview() {
	buzz_sounds.forEach(function(buzz, i){
		/* Create an audio player */
		$('<audio/>', {
			id: 'buzz_player_'+buzz[0],
			"src": 'quiz_buzzes/'+buzz[0]+'.wav',
		}).appendTo('#sounds_placeholder');
	});
}

function getBuzzSoundsSelect(client_id, client_sound) {
	var returnHTML = "";
	/* No sound selection if it's the controller */
	if(client_id != 1) {
		if(game_in_progress == 1) {
			/* Make select field disabled if the game's in progress */
			returnHTML += '<select id="buzz_sounds_'+client_id+'" disabled="disabled">\n';
		} else {
			/* Select field is enabled if not */
			returnHTML += '<select id="buzz_sounds_'+client_id+'">\n';
		}
		buzz_sounds.forEach(function(buzz, i){
			var selected = "";
			if(buzz[0] == Number(client_sound)) selected = " selected=\"selected\"";

			returnHTML += '<option value="'+buzz[0]+'"'+selected+'>'+buzz[1]+'</option>\n';
		});
		returnHTML += '</select>\n';
	}
	return returnHTML;
}

function updateClientList(result) {
	/* Clear current client table */ 
	$("#clientTableBody").html("");
	/* Loop through each client in the database and add to the table */
	$.each(result, function(i, client){
		/* Get colour of client */
		var client_colour = "<em>Controller</em>";
		switch (client['client_colour']) {
			case 'r': client_colour = "Red"; break;
			case 'b': client_colour = "Blue"; break;
			case 'g': client_colour = "Green"; break;
			case 'y': client_colour = "Yellow"; break;
			case 'w': client_colour = "White"; break;
		}
		/* Get buzz enabled status */
		var checked = "";
		if(client['client_buzz_allowed'] == 1) {
			checked = "checked=\"checked\"";
		}
		if(game_in_progress != 1) {
			if(client['client_colour'] == null) {
				checked = "disabled=\"disabled\"";
			}
		} else {
			checked = "disabled=\"disabled\"";
		}
		/* Get battery status */
		var battery_status;
		if(client['client_id'] != 1) {
			switch(client['client_charge']) {
				case 3: battery_status = "Charged"; break;
				case 2: case 1: battery_status = "<em>Charging</em>"; break;
				default: battery_status = "Not charging"; break;
			}
		} else {
			battery_status = "";
		}
		/* Create our new table row */
		$('<div/>', {
			id: 'client_row_id_'+client['client_id'],
			"class": 'gameTableRow',
		}).appendTo('#clientTableBody');

		/* Add the cells, first the client ID */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 50px; border-right: 1px solid #333;',
			text: client['client_id']
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Client colour */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 230px; border-right: 1px solid #333;',
			html: client_colour
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Buzz enabled checkedbox */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 130px; border-right: 1px solid #333;',
			html: "<input type=\"checkbox\" id=\"enable_buzz_"+client['client_id']+"\" class=\"enable_buzz\" "+checked+" />"
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Battery status */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 150px; border-right: 1px solid #333;',
			html: battery_status
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Buzz sound selection */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 130px; border-right: 1px solid #333;',
			html: getBuzzSoundsSelect(client['client_id'], client['client_sound'])
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Buzz sound preview */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 40px;',
			html: function() {
				if(client['client_id'] != '1') {
					return "<a href=\"#\"><img src=\"play.png\" id=\"buzz_play_btn_"+client['client_id']+"\"/></a>"
				} else {
					return "";
				}
			}
		}).appendTo('#client_row_id_'+client['client_id']);

		/* Add event listener for "Buzz Enabled" - remove any previous listeners first */
		$("#enable_buzz_"+client['client_id']).off(); 
		$("#enable_buzz_"+client['client_id']).on("change", function() {
			updateClientBuzzEn(client['client_id'], $("#enable_buzz_"+client['client_id']).prop('checked'));
		});
		/* Add event listener for "Buzz Sound" - remove any previous listeners first */
		$("#buzz_sounds_"+client['client_id']).off(); 
		$("#buzz_sounds_"+client['client_id']).on("change", function() {
			updateClientSound(client['client_id'], parseInt($("#buzz_sounds_"+client['client_id']).val()));
		});
		/* Add event listener for "Buzz Sound Preview" - remove any previous listeners first */
		$("#buzz_play_btn_"+client['client_id']).off(); 
		$("#buzz_play_btn_"+client['client_id']).on("click", function() {
			$("#buzz_player_"+$("#buzz_sounds_"+client['client_id']).val()).trigger('play');
		});
	});

	/* Once done, check to see if we need to highlight a winner from the previous round */
	if(winning_row != false) {
		$('#client_row_id_'+winning_row).css("background-color", "#e04a4f");
		winning_row = false;
	}
	
}

function updateClientBuzzEn(client_id, buzz_en) {
	var set_buzz_en;
	if(buzz_en) {
		set_buzz_en = 1;
	} else {
		set_buzz_en = 0;
	}

	send_socket_request("set_buzz_en", {"buzz_en":set_buzz_en, "client_id":client_id});
}

function updateClientSound(client_id, client_sound) {
	/* Set buzz sound in database */
	send_socket_request("set_buzz_sound", {"buzz_sound":client_sound, "client_id":client_id});
	
}

function update_game_button() {
	if(game_in_progress == '1') {
		$("#control_game_in_progress").html("Stop Game");
		$("#control_game_state").removeClass("state_button_disabled");
	} else {
		$("#control_game_in_progress").html("Start Game");
		$("#control_game_state").addClass("state_button_disabled");
	}
}

function update_round_button() {
	if(game_state == '0') {
		$("#control_game_state").html("Reset Round");
		$("#control_game_state").addClass("state_button_disabled");
	} else {
		$("#control_game_state").html("Reset Round");
		$("#control_game_state").removeClass("state_button_disabled");
	}
}

function update_game_status() {
	var status_HTML = "";
	if(game_in_progress == '1') {
		status_HTML = "Game Running";
		if(game_state != '0') {
			status_HTML += " - Answered";
		} else {
			status_HTML += " - <em>Waiting for Answer</em>";
		}
	} else {
		status_HTML = "Game Stopped";
	}

	$("#game_status").html(status_HTML);
}

function game_parse_broadcast(received_JSON) {

	switch(received_JSON["message"]) {
		case "client_list_change":
			/* Update our client table */
			send_socket_request("get_client_list");
			break;
		case "game_admin_change":
			/* Game admin data has changed - store current game data to comapre */
			var current_game_in_progress = game_in_progress;
			var current_game_state = game_state;

			var game_data = received_JSON["data"]
			/* Copy the data into our local variables */
			game_in_progress = game_data['game_in_progress'];
			game_state = game_data['game_state'];
			
			/* Now see if anything's updated */
			if((current_game_in_progress != game_in_progress) || (current_game_state != game_state)) {
				/* Update game start stop button */
				update_game_button();
				/* Update round start stop button */
				update_round_button();
				/* Update game status text */
				update_game_status();
			}
			break;
		case "buzz_en_change":
			/* Buzz enable change - just reload the client list */
			send_socket_request("get_client_list");
			break;
		case "reset":
			/* Game as just been reset, let's reload the game admin data and client table */
			game_in_progress = -1; // Force a reload
			send_socket_request("get_admin_data");
			break;
		case "buzz_in":
			/* Someone's buzzed in */
			winning_row = received_JSON["data"]["client_id"];
			$('#client_row_id_'+winning_row).css("background-color", "#e04a4f");
			send_socket_request("get_admin_data");
			break;
	}

}

$(document).ready(function() {
	/* Initialisation functions */
	/* Loads sounds to allow previews to work */
	loadSoundsPreview();

	/* Start/Stop game button click event */
	$("#control_game_in_progress").click(function() {
		var set_game_progress;
		
		if(game_in_progress == '1') {
			set_game_progress = "0";
		} else {
			set_game_progress = "1";
		}
		
		send_socket_request("set_game_in_progress", {"set_value":set_game_progress});
	});


	$("#control_game_state").click(function() {
		if(game_in_progress == '1') {
			/* Game in progress, so we can reset round round */
			if(game_state != '0') {
				/* Reset the round, only if it needs resetting */
				send_socket_request("set_game_state", {"set_value":"0"});
			} else {
				/* Wait for buzz in before reset round */
			}
		} else {
			/* Game hasn't started yet */
		}
	});

	$("#control_reset_game").click(function() {
		/* Reset game */
		$("#game_status").html("<em>Game Resetting</em>");
		/* Wait 1s before resetting to show acknowledgement to user */
		setTimeout(function() {
			/* Reset the game */
			send_socket_request("reset_game", "");
		}, 1000);
	});

});
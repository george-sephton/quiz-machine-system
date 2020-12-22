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

var game_rounds = [];

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

function translated_client_colour(colour) {
	switch (colour) {
		case 'r': return "red"; break;
		case 'b': return "blue"; break;
		case 'g': return "green"; break;
		case 'y': return "yellow"; break;
		case 'w': return "white"; break;
	}
}

function updateClientList(result) {
	/* Clear current client table */ 
	$("#clientTableBody").html("");
	/* Loop through each client in the database and add to the table */
	$.each(result, function(i, client){
		/* Get colour of client */
		var client_colour = translated_client_colour(client['client_colour']);
		if(client['client_id'] != 1) {
			if( (client['player_name'] == null) || (client['player_name'] == ""))
				var player_name = "<span style=\"color: "+client_colour+"; text-transform:capitalize;\">"+client_colour+"</span>";
			else
				var player_name = "<span style=\"color: "+client_colour+"\">"+client['player_name']+"</span>"; 
		} else {
			var player_name = "<em>Controller</em>";
		}

		/* Get buzz enabled status */
		var checked = "";
		var disabled = "";
		console.log(client['client_buzz_allowed']);
		if(client['client_buzz_allowed'] == 1) {
			checked = "checked=\"checked\"";
		}
		if(game_in_progress != 1) {
			if(client['client_colour'] == null) {
				disabled = "disabled=\"disabled\"";
			}
		} else {
			disabled = "disabled=\"disabled\"";
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
			"client_id": client['client_id'],
			"class": 'gameTableRow clientRow',
		}).appendTo('#clientTableBody');

		/* Add the cells, first the client ID */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 30px; border-right: 1px solid #333;',
			text: client['client_id']
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Player name */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 180px; border-right: 1px solid #333;',
			id: 'player_name_'+client['client_id'],
			html: player_name
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Buzz enabled checkedbox */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 110px; border-right: 1px solid #333;',
			html: function () {
				if(client['client_id'] != '1') {
					return "<input type=\"checkbox\" id=\"enable_buzz_"+client['client_id']+"\" class=\"enable_buzz\" "+checked+" "+disabled+" />";
				} else {
					return "";
				}
			}
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Battery status */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 90px; border-right: 1px solid #333;',
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
			"style": 'width: 40px; border-right: 1px solid #333;',
			html: function() {
				if(client['client_id'] != '1') {
					return "<a href=\"#\"><img src=\"play.png\" id=\"buzz_play_btn_"+client['client_id']+"\"/></a>"
				} else {
					return "";
				}
			}
		}).appendTo('#client_row_id_'+client['client_id']);
		/* Score */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 150px;',
			html: function() {
				if(client['client_id'] != '1') {
					return "<a href=\"#\" class=\"score_change_link\" client_id=\""+client['client_id']+"\" score_change=\"-2\" style=\"margin-right: 3px;\">-2</a><a href=\"#\" class=\"score_change_link\" client_id=\""+client['client_id']+"\" score_change=\"-1\" style=\"margin-right: 6px;\">-1</a><span id=\"player_score_"+client['client_id']+"\">"+client['player_score']+"</span><a href=\"#\" class=\"score_change_link\" client_id=\""+client['client_id']+"\" score_change=\"1\" style=\"margin-left: 6px;\">+1</a><a href=\"#\" class=\"score_change_link\" client_id=\""+client['client_id']+"\" score_change=\"2\" style=\"margin-left: 3px;\">+2</a>";
				} else {
					return "";
				}
			}
		}).appendTo('#client_row_id_'+client['client_id']);

		/* Add event listener for "Player Name" - remove any previous listeners first */
		if(client['client_id'] != 1) {
			$("#player_name_"+client['client_id']).off();
			$("#player_name_"+client['client_id']).dblclick(function() {
				
				var name_update_show = "";
				if(client['player_name'] != null) name_update_show = client['player_name'];
				
				$(this).html("<input id=\"player_name_update_"+client['client_id']+"\" class=\"player_name_update\" placeholder=\""+name_update_show+"\" />");
				$("#player_name_update_"+client['client_id']).focus();
				
				/* Add event listener for "Player Name Update" - remove any previous listeners first */
				$("#player_name_update_"+client['client_id']).bind('blur keyup',function(e) {  
	          		if (e.type === 'blur' || e.keyCode === 13) {
						var update_name = $("#player_name_update_"+client['client_id']).val();

						if(update_name != "") {
							var updated_player_name = "<span style=\"color: "+translated_client_colour(client['client_colour'])+";\">"+update_name+"</span>";
						} else {
							var updated_player_name = "<span style=\"color: "+translated_client_colour(client['client_colour'])+"; text-transform:capitalize;\">"+translated_client_colour(client['client_colour'])+"</span>";
						}
						$("#player_name_"+client['client_id']).html(updated_player_name);

						send_socket_request("update_player_name", {"name":update_name, "client_id":client['client_id']});
					}
				});
				
			});
		}
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
			if(game_in_progress == 0) {
				$("#buzz_player_"+$("#buzz_sounds_"+client['client_id']).val()).trigger('play');
			}
		});
	});

	/* Add Score Change event listener */
	$(".score_change_link").off();
	$(".score_change_link").click(function() {
		send_socket_request("score_update", {"score_change":parseInt($(this).attr("score_change")), "client_id":parseInt($(this).attr("client_id"))});
	});

	/* Once done, check to see if we need to highlight a winner from the previous round */
	if(winning_row != false) {
		$('#client_row_id_'+winning_row).css("background-color", "#e04a4f");
		winning_row = false;
	}
	
}

function updateRoundsList() {
	/* Clear current client table */ 
	$("#roundTableBody").html("");

	$.each(game_rounds, function(i, round){
		/* Create our new table row */
		$('<div/>', {
			id: 'round_row_id_'+round['round_id'],
			"round_id": round['round_id'],
			"class": 'gameTableRow roundRow',
		}).appendTo('#roundTableBody');

		/* Add the cells, first the Round Name */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 220px; border-right: 1px solid #333;',
			text: round['round_name']
		}).appendTo('#round_row_id_'+round['round_id']);

		if(round['round_en']) {
			var round_en_checkbox = "checked=\"checked\"";
		} else {
			var round_en_checkbox = "";
		}
		/* Round Enable */
		$('<div/>', {
			"class": 'gameTableCell',
			"style": 'width: 40px;',
			html: "<input type=\"checkbox\" id=\"enable_round_"+round['round_id']+"\" class=\"enable_round\" "+round_en_checkbox+" />"
		}).appendTo('#round_row_id_'+round['round_id']);

		/* Add event listener for "Buzz Enabled" - remove any previous listeners first */
		$("#enable_round_"+round['round_id']).off(); 
		$("#enable_round_"+round['round_id']).on("change", function() {
			updateRoundEn(round['round_id'], $("#enable_round_"+round['round_id']).prop('checked'));
		});
	});

	/* Create gamble row */
	$('<div/>', {
		id: 'round_row_id_gamble',
		"class": 'gameTableRow roundRow',
	}).appendTo('#roundTableBody');

	/* Add the cells, first the Round Name */
	$('<div/>', {
		"class": 'gameTableCell',
		"style": 'width: 220px; border-right: 1px solid #333;',
		text: "Gamble"
	}).appendTo('#round_row_id_gamble');

	/* Round Enable */
	$('<div/>', {
		"class": 'gameTableCell',
		"style": 'width: 40px;',
		html: ""
	}).appendTo('#round_row_id_gamble');
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

function updateRoundEn(round_id, round_en) {
	var set_round_en;
	if(round_en) {
		set_round_en = 1;
	} else {
		set_round_en = 0;
	}

	send_socket_request("set_round_en", {"round_en":set_round_en, "round_id":round_id});
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

function update_buzz_status(disabled_state) {
	$("#clientTableBody").find(".gameTableRow").each(function(index){
		if($(this).attr("client_id") != 1) {
			if(disabled_state == 1) {
				$(this).find(".gameTableCell").find("select, input").prop('disabled', 'disabled');
			} else {
				$(this).find(".gameTableCell").find("select, input").prop('disabled', '');
			}
		}
	});
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
				/* Update buzz disabled status */
				update_buzz_status(game_in_progress);
				/* Reset the row colours to remove any highlighted winners */
				$(".clientRow").css("background-color", "");
			}
			break;
		case "round_en_change":
			/* Update the game rounds */
			var rounds = received_JSON["data"];
				
			game_rounds = [];
			var index = 0;
			$(rounds).each(function(i) {
				game_rounds[index] = ({"round_id": rounds[i]["round_id"], "round_name": rounds[i]["round_name"], "round_en": rounds[i]["round_en"]});
				index++;
			});
			updateRoundsList();
			break;
		case "buzz_en_change":
			/* Buzz enable change - just reload the client list */
			send_socket_request("get_client_list");
			break;
		case "reset":
			/* Game as just been reset, let's reload the game admin data and client table */
			game_in_progress = -1; // Force a reload
			send_socket_request("get_admin_data");
			/* Clear the rounds table */
			$(".roundRow").css("background-color", "");
			$(".clientRow").css("background-color", "");
			break;
		case "buzz_in":
			/* Someone's buzzed in */
			winning_row = received_JSON["data"]["client_id"];
			$('#client_row_id_'+winning_row).css("background-color", "#e04a4f");
			send_socket_request("get_admin_data");
			break;
		case "randomised_round_result":
			/* Show what the randomised round is */
			$("#game_round_placeholder").html(received_JSON["data"]);
			break;
		case "randomised_player_result":
			/* Show who the randomised player is */
			$('#client_row_id_'+received_JSON["data"]).css("background-color", "#d8e04a");
			break;
		case "gamble_id":
			/* Clear the round that was replaced by a Gamble option */
			$("#round_row_id_"+received_JSON["data"]).css("background-color", "");
			$("#round_row_id_gamble").css("background-color", "#e04a4f");
			break;
		case "player_score_change":
			/* Player's score has changed */
			$("#player_score_"+received_JSON["data"]["client_id"]).html(received_JSON["data"]["player_score"]);
			break;
	}
}

function shuffle_array(array) {
	var currentIndex = array.length, temporaryValue, randomIndex;
	
	while (0 !== currentIndex) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}
	return array;
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

	/* Shuffle board button click event */
	$("#board_shuffle").click(function() {
		$("#game_round_placeholder").html("");

		/* Shuffle the game rounds */
		game_rounds = shuffle_array(game_rounds);
		$("#round_row_id_gamble").css("background-color", "");
		$(".roundRow").css("background-color", "");
		for(var j=1; j<10; j++) {
			$("#round_row_id_"+game_rounds[j]["round_id"]).css("background-color", "#e04a4f");
		}
		send_socket_request("broadcast_board_shuffle", {"order": game_rounds});
	});

	/* Randomise board button click event */
	$("#board_randomise").click(function() {
		$("#game_round_placeholder").html("");
		send_socket_request("broadcast_board_randomise", "");
	});

	/* Randomise board button click event */
	$("#player_randomise").click(function() {
		$(".clientRow").css("background-color", "");
		send_socket_request("broadcast_player_randomise", "");
	});
});
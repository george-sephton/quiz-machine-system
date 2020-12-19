# Import Python libraries
import time
import json
from datetime import timedelta
import pygame

# Import Tornado libraries
import tornado.web
import tornado.httpserver
import tornado.ioloop
import tornado.websocket as ws
from tornado.options import define, options

# Include local files
from game_mysql import *
from game_button import *
from game_leds import *

# Status Codes
# 0 - Request successful
# 1 - MySQL error
# 2 - MySQL query failure
# 3 - GET variables error
# 4 - Game error
# 5 - Bad request

# Registration example
#{"request": "register_self", "client_id": "", "data": {"client_colour": "b", "battery_charge": 0}}

# Buzz in example:
#{"request": "buzz_in", "client_id": "3", "data": ""}

# Battery charging status update example:
#{"request": "update_battery", "client_id": "3", "data": {"battery_charge": 3}}


# PyGame initialise
pygame.mixer.init()
pygame.mixer.music.set_volume(0.5)

# Game variable
buzzed_in = False

# Websockets handler
class WebSocketHandler(tornado.websocket.WebSocketHandler):

	ws_connections = set()
	buttons_handles = [Button(10), Button(27), Button(9), Button(25), Button(8), Button(11), Button(5)]

	# Called when new connection opened
	def open(self):
		WebSocketHandler.ws_connections.add(self)

	# Called when a message is received
	def on_message(self, message):
		
		print("Message received: {}".format(message))
		json_data = json.loads(message)

		# Check if the request was set correctly
		try: json_data["request"]
		except KeyError: json_data["request"] = None

		self.write_message(json.dumps(self.game_controller_parse_request(json_data)))
	
	# Called when a connection closes
	def on_close(self):
		WebSocketHandler.ws_connections.remove(self)

	# Broadcast message to all clients
	def game_controller_broadcast(self, json_message):
		[client.write_message(json.dumps(json_message)) for client in self.ws_connections]

	# Accept all cross-origin traffic
	def check_origin(self, origin):
		return True

	def periodic_winner_check(self):

		global buzzed_in

		game_admin_rows, admin_data = game_mysql_select("SELECT * FROM tbl_game_admin WHERE game_id = 1 LIMIT 1;", None)
		
		if game_admin_rows == 1:
			if admin_data[0]["game_state"] == 1:

				if buzzed_in == False:
					# Someone buzzed in, let's find out who
					game_messages_rows, game_messages = game_mysql_select("SELECT * FROM tbl_messages ORDER BY message_time ASC LIMIT 1;", None)
					if game_admin_rows == 1:

						winning_client_id = game_messages[0]['message_client_from']
						# Broadcast the result
						broadcast_msg = {"request": "broadcast", "message": "buzz_in", "data": {"client_id": winning_client_id}}
						self.game_controller_broadcast(self=self, json_message=broadcast_msg)
						buzzed_in = True

						# Get the winning client info
						client_rows, client_data = game_mysql_select("SELECT * FROM tbl_clients WHERE client_id = %s LIMIT 1;", (winning_client_id,))
						if client_rows == 1:
							
							# Play the correct audio file
							client_sound = "quiz_buzzes/" + str(client_data[0]["client_sound"]) + ".wav"
							pygame.mixer.music.load(client_sound)
							pygame.mixer.music.play()
							
							# Flash the LEDs
							time.sleep(0.3)
							flash_leds(client_data[0]["client_colour"])

							game_mysql_update("UPDATE tbl_game_admin SET game_state = '2' WHERE game_id = 1;", None)

							# Wait for everyting to end 
							while pygame.mixer.music.get_busy() == True:
								continue


						else:
							# Error getting winner's data
							print("Error getting winner's data")

					else:
						# Error getting the messages
						print("Error reading messages")
		else:
			# Couldn't get game admin data
			print("Error getting game admin data")

		tornado.ioloop.IOLoop.instance().add_timeout(timedelta(milliseconds=50), self.periodic_winner_check, self)

	def periodic_button_handler(self):
		try:
			for buttons_handle in self.buttons_handles:
				if buttons_handle.pressed():
					self.game_controller_parse_button_press(self=self, pin=buttons_handle.channel)

		finally:
			tornado.ioloop.IOLoop.instance().add_timeout(timedelta(milliseconds=10), self.periodic_button_handler, self)

	# Parse button press
	def game_controller_parse_button_press(self, pin):

		# Get Game Admin Data first
		game_admin_rows, game_admin_data = game_mysql_select("SELECT * FROM tbl_game_admin WHERE game_id = '1' LIMIT 1;", None)
		if game_admin_rows == 1:
			if pin == 10:
				# Start/Stop Game
				if game_admin_data[0]['game_in_progress'] == 0:
					set_game_in_progress = 1
				else:
					set_game_in_progress = 0
				
				update_value_json = {"request": "set_game_in_progress", "data": {"set_value": set_game_in_progress}}

				self.game_controller_parse_request(self, update_value_json, False);
				# Broadcast
				broadcast_msg = {"request": "broadcast", "message": "game_admin_change", "data": {"game_in_progress": set_game_in_progress, "game_state": 0}}
				self.game_controller_broadcast(self=self, json_message=broadcast_msg)

			elif pin == 27:
				# Reset Round
				if game_admin_data[0]['game_in_progress'] == 1 and game_admin_data[0]['game_state'] != 0:
					update_value_json = {"request": "set_game_state", "data": {"set_value": 0}}
					self.game_controller_parse_request(self, update_value_json, False);
					# Broadcast
					broadcast_msg = {"request": "broadcast", "message": "game_admin_change", "data": {"game_in_progress": 1, "game_state": 0}}
					self.game_controller_broadcast(self=self, json_message=broadcast_msg)

			else:
				# Client Button Press - buttons control buzz enabled whilst game hasn't started
				if game_admin_data[0]['game_in_progress'] == 0:
					
					# Get the colour of button - I apologise for the inefficiency in this code
					button_colour = 0
					if pin == 9:
						button_colour = button_led_order[0]
					elif pin == 25:
						button_colour = button_led_order[1]
					elif pin == 8:
						button_colour = button_led_order[2]
					elif pin == 11:
						button_colour = button_led_order[3]
					elif pin == 5:
						button_colour = button_led_order[4]

					if button_colour != 0:

						# Get the correct client id and current buzz_en value
						no_clients, client_list = game_mysql_select("SELECT * FROM tbl_clients WHERE client_colour = %s LIMIT 1;", (button_colour,))
						if no_clients >= 0:
							
							button_client_id = client_list[0]['client_id']
							if client_list[0]['client_buzz_allowed'] == 1:
								set_buzz_en = 0
							else:
								set_buzz_en = 1

							update_value_json = {"request": "set_buzz_en", "data": {"buzz_en": set_buzz_en, "client_id": button_client_id}}
							self.game_controller_parse_request(self, update_value_json, False);
							# Broadcast
							broadcast_msg = {"request": "broadcast", "message": "buzz_en_change", "data": {"client_id": button_client_id, "buzz_en_state": set_buzz_en}}
							self.game_controller_broadcast(self=self, json_message=broadcast_msg)
						
						else:
							print("Error getting client data")
					
		else:
			print("Error getting game admin data")

	# Parse incoming request
	def game_controller_parse_request(self, input_json, broadcast_en = True):

		global buzzed_in

		# Create the return JSON - default status value is 5 (Bad request)	
		json_data = '{"request":"","status":"5","result":""}'
		json_object = json.loads(json_data) 

		# Create connection to MySQL 
		if game_mysql_connect():

			# Get request
			try: input_json["request"]
			except KeyError: input_json["request"] = None
			request = input_json["request"]
			json_object["request"] = request

			# Get client ID
			try: input_json["client_id"]
			except KeyError: input_json["client_id"] = None
			client_id = input_json["client_id"]

			# Get data
			try: input_json["data"]
			except KeyError: input_json["data"] = None
			data = input_json["data"]

			######### UPDATE BATTERY STATUS #########
			if request == "update_battery":

				# Get the required variable
				try: data["battery_charge"]
				except KeyError: data["battery_charge"] = None

				# Check if variable provided is correct
				if data["battery_charge"] != None and client_id != None:

					# Check if charing status is valid
					if data["battery_charge"] >= 0 and data["battery_charge"] <= 3:

						# Update charging status
						if game_mysql_update("UPDATE tbl_clients SET client_charge = %s WHERE client_id = %s;", (data["battery_charge"], client_id)):
							
							# Update successful, broadcast that the client info has changed
							if broadcast_en:
								broadcast_msg = {"request": "broadcast", "message": "client_list_change"}
								self.game_controller_broadcast(broadcast_msg)

							json_object["status"] = "0"
						
						else:
							# Couldn't update battery charging status
							json_object["status"] = "2"

					else:
						# Variables Error
						json_object["status"] = "3"

				else:
					# Variables Error
					json_object["status"] = "3"

			######### REGISTER SELF #########
			if request == "register_self":

				# Get the required variables
				try: data["client_colour"]
				except KeyError: data["client_colour"] = None

				try: data["battery_charge"]
				except KeyError: data["battery_charge"] = None

				# Check if variables provided are correct
				if data["client_colour"] != None and data["battery_charge"] != None:

					# Check to see if the client has already registered
					no_clients, client_list = game_mysql_select("SELECT * FROM tbl_clients WHERE client_colour = %s LIMIT 1;", (data["client_colour"],))
					if no_clients >= 0:

						# Retrieved results successfully
						if no_clients == 0:

							# No results found, we need to register a new client
							game_admin_rows, game_admin_data = game_mysql_select("SELECT * FROM tbl_game_admin WHERE game_id = '1' LIMIT 1;", None)
							if game_admin_rows == 1:

								# Get the game admin data to see if the game has started or not
								if game_admin_data[0]['game_in_progress'] == 0:

									# Game not started, let's register the client
									inserted_client_row_id = game_mysql_insert("INSERT INTO tbl_clients (client_id, client_colour, client_buzz_allowed, client_sound, client_charge) VALUES (NULL, %s, '1', '1', %s);", ( data["client_colour"], str(data["battery_charge"]) ))
									if inserted_client_row_id != False:

										if game_mysql_update("INSERT INTO tbl_players (client_id) VALUES (%s);", (str(inserted_client_row_id),)):

											# Insert successful, Get new client ID
											no_clients2, client_list2 = game_mysql_select("SELECT * FROM tbl_clients WHERE client_id = %s LIMIT 1;", (str(inserted_client_row_id),))

											if no_clients2 == 1:
												# Everything went well, broadcast that a new client has joined
												if broadcast_en:
													broadcast_msg = {"request": "broadcast", "message": "client_list_change"}
													self.game_controller_broadcast(broadcast_msg)
												# Update LEDs
												load_led_colours()
												# Return status 0 along with new client id
												json_object["result"] = str(client_list2[0]['client_id'])
												json_object["status"] = "0"
											
											else: 
												# Error retrieving registered ID
												json_object["status"] = "2"
										else:
											# Error registering player
											json_object["status"] = "2"

									else:
										# Error registering client
										json_object["status"] = "2"
								
								else:
									# Game already started, can't register client
									json_object["status"] = "4"

							else:
								# Error getting admin data
								json_object["status"] = "2"

						else:
							# Client already registered, update the battery chargin status and return the client ID
							if game_mysql_update("UPDATE tbl_clients SET client_charge = %s WHERE client_id = %s;", (data["battery_charge"], client_list[0]['client_id'])):
								
								# Update successful, broadcast that the client info has changed
								if broadcast_en:
									broadcast_msg = {"request": "broadcast", "message": "client_list_change"}
									self.game_controller_broadcast(broadcast_msg)

								json_object["result"] = str(client_list[0]['client_id'])
								json_object["status"] = "0"
							
							else:
								# Couldn't update battery charging status
								json_object["status"] = "2"

					else:
						# Couldn't get game admin data
						json_object["status"] = "2"

				else:
					# Variables Error
					json_object["status"] = "3"

			######### BUZZ IN #########
			elif request == "buzz_in":

				# Check if variable is provided
				if input_json["client_id"] != None:

					# Add Buzz in to messages table
					inserted_row_id = game_mysql_insert("INSERT INTO tbl_messages (message_id, message_time, message_client_to, message_client_from, message_read, message_short) VALUES (NULL, CURRENT_TIMESTAMP, '1', %s, '0', 'buzz');", (input_json["client_id"],))
					if inserted_row_id != False:
						
						# Insert successful - update game state
						if game_mysql_update("UPDATE tbl_game_admin SET game_state = 1 WHERE game_id = 1;", None):
							json_object["status"] = "0"
						else:
							# Couldn't get update game admin data
							json_object["status"] = "2"

					else:
						# Fatal Error
						print("Buzz in failed")
						json_object["status"] = "2"

				else:
					# Fatal Error
					print("Buzz in without client ID")
					json_object["status"] = "2"

			######### GET CLIENT LIST #########
			elif request == "get_client_list":
				
				return_clients = []
				# Returns the list of clients
				no_clients, client_list = game_mysql_select("SELECT * FROM tbl_clients;", None)
				if no_clients >= 0:

					for client in client_list:

						no_players, player_list = game_mysql_select("SELECT player_name, player_score FROM tbl_players WHERE client_id = %s;", (str(client["client_id"]),))
						if no_players >= 0:

							add_client = client
							add_client.update(player_list[0])
							return_clients.append(add_client)

					json_object["status"] = "0"
					json_object["result"] = return_clients
					
				else:
					# Couldn't get client list
					json_object["status"] = "2"

			######### GET GAME ADMIN DATA #########
			elif request == "get_admin_data":
				
				# Check to see if the client has already registered
				game_admin_rows, admin_data = game_mysql_select("SELECT * FROM tbl_game_admin WHERE game_id = 1 LIMIT 1;", None)
				if game_admin_rows == 1:
					json_object["status"] = "0"
					json_object["result"] = admin_data[0]
				else:
					# Couldn't get client list
					json_object["status"] = "2"

			######### GET GAME ROUNDS #########
			elif request == "get_rounds":
				
				# Check to see if the client has already registered
				rounds_rows, rounds_data = game_mysql_select("SELECT * FROM tbl_rounds;", None)
				if rounds_rows >= 1:
					json_object["status"] = "0"
					json_object["result"] = rounds_data
				else:
					# Couldn't get client list
					json_object["status"] = "2"

			######### GET BUZZ ENABLE STATE #########
			elif request == "get_buzz_en":

				# Check if variables are provided
				if client_id != None:

					# Check if variables provided are correct
					if int(client_id) > 0 and int(client_id) < 10:

						# Update table with new game state value
						client_rows, client_data = game_mysql_select("SELECT * FROM tbl_clients WHERE client_id = %s LIMIT 1;", (str(client_id),))
						if client_rows == 1:
							# Everything went well, broadcast that the client list has changed
							json_object["result"] = client_data[0]["client_buzz_allowed"]
							json_object["status"] = "0"
						else:
							# Couldn't get client data
							json_object["status"] = "2"

					else:
						# Variables Error
						json_object["status"] = "3"

				else:
					# Missing Variables
					json_object["status"] = "3"

			######### SET GAME IN PROGRESS #########
			elif request == "set_game_in_progress":
				
				buzzed_in = False
				# Get the required variable
				try: data["set_value"]
				except KeyError: data["set_value"] = None

				if data["set_value"] != None:
					
					# Truncate messages table
					if game_mysql_update("TRUNCATE TABLE tbl_messages;", None):

						# Update table with new game in progress value
						if game_mysql_update("UPDATE tbl_game_admin SET game_in_progress = %s, game_state = '0' WHERE game_id = 1;", (str(data["set_value"]),)):

							# Everything went well, broadcast that the game status has changed
							if broadcast_en:
								broadcast_msg = {"request": "broadcast", "message": "game_admin_change", "data": {"game_in_progress": data["set_value"], "game_state": 0}}
								self.game_controller_broadcast(broadcast_msg)
							# Update LEDs
							load_led_colours()
							json_object["status"] = "0"
						else:
							# Couldn't get update game admin data
							json_object["status"] = "2"

					else:
						# Couldn't truncate messages table
						json_object["status"] = "2"
				else:
					# Variables Error
					json_object["status"] = "3"

			######### SET GAME STATE #########
			elif request == "set_game_state":
				
				buzzed_in = False
				# Get the required variable
				try: data["set_value"]
				except KeyError: data["set_value"] = None

				if data["set_value"] != None:

					# Truncate messages table
					if game_mysql_update("TRUNCATE TABLE tbl_messages;", None):

						# Update table with new game state value
						if game_mysql_update("UPDATE tbl_game_admin SET game_state = %s WHERE game_id = 1;", (str(data["set_value"]),)):
							# Everything went well, broadcast that the game status has changed
							if broadcast_en:
								broadcast_msg = {"request": "broadcast", "message": "game_admin_change", "data": {"game_in_progress": 1, "game_state": data["set_value"]}}
								self.game_controller_broadcast(broadcast_msg)
							# Update LEDs
							load_led_colours()
							json_object["status"] = "0"
						else:
							# Couldn't get update game admin data
							json_object["status"] = "2"

					else:
						# Couldn't truncate messages table
						json_object["status"] = "2"

				else:
					# Variables Error
					json_object["status"] = "3"

			######### SET PLAYER NAME #########
			elif request == "update_player_name":
				# Get the required variable
				try: data["name"]
				except KeyError: data["name"] = None

				try: data["client_id"]
				except KeyError: data["client_id"] = None

				# Check if variables are provided
				if data["name"] != None and data["client_id"] != None:

					# Check if variables provided are correct
					if data["client_id"] > 0 and data["client_id"] < 10:

						# Update table with new game state value
						if game_mysql_update("UPDATE tbl_players SET player_name = %s WHERE client_id = %s;", (str(data["name"]), str(data["client_id"]))):
							# Everything went well, broadcast that the client list has changed
							if broadcast_en:
								broadcast_msg = {"request": "broadcast", "message": "player_name_change", "data": {"client_id": data["client_id"], "player_name": data["name"]}}
								self.game_controller_broadcast(broadcast_msg)
							json_object["status"] = "0"
						else:
							# Couldn't update client data
							json_object["status"] = "2"

					else:
						# Variables Error
						json_object["status"] = "3"

				else:
					# Missing Variables
					json_object["status"] = "3"

			######### SHUFFLE BOARD #########
			elif request == "broadcast_board_shuffle":
				
				try: data["order"]
				except KeyError: data["order"] = None

				if data["order"] != None:

					if broadcast_en:
						broadcast_msg = {"request": "broadcast", "message": "board_shuffle", "data": data["order"]}
						self.game_controller_broadcast(broadcast_msg)
						json_object["status"] = "0"

				else:
					# Missing Variables
					json_object["status"] = "3"

			######### BROADCAST RANDOMISE BOARD #########
			elif request == "broadcast_board_randomise":
				if broadcast_en:
					broadcast_msg = {"request": "broadcast", "message": "board_randomise"}
					self.game_controller_broadcast(broadcast_msg)
				json_object["status"] = "0"

			######### BROADCAST RANDOMISE RESULT #########
			elif request == "broadcast_board_randomise_result":

				try: data["round"]
				except KeyError: data["round"] = None

				if data["round"] != None:

					if broadcast_en:
						broadcast_msg = {"request": "broadcast", "message": "randomised_round_result", "data": data["round"]}
						self.game_controller_broadcast(broadcast_msg)
					json_object["status"] = "0"

				else:
					# Missing Variables
					json_object["status"] = "3"



				
			######### RESET GAME #########
			elif request == "reset_game":

				# First reset the client list and messages table
				if game_mysql_multi_update("TRUNCATE TABLE tbl_clients; TRUNCATE TABLE tbl_players; TRUNCATE TABLE tbl_messages; ALTER TABLE tbl_clients AUTO_INCREMENT = 1; ALTER TABLE tbl_messages AUTO_INCREMENT = 1;", None):
					# Add the controller to the clients table
					reset_row_count = game_mysql_insert("INSERT INTO tbl_clients (client_id) VALUES (NULL);", None)
					if reset_row_count == 1:

						# Add the controller to the clients table
						if game_mysql_update("INSERT INTO tbl_players (client_id) VALUES (1);", None):
						
							# Client list reset, now update game admin table
							if game_mysql_update("UPDATE tbl_game_admin SET game_in_progress = '0', game_state = '0' WHERE game_id = 1;", None):
								# Everything should have been reset correctly, broadcast reset signal
								if broadcast_en:
									broadcast_msg = {"request": "broadcast", "message": "reset"}
									self.game_controller_broadcast(broadcast_msg)
								# Update LEDs
								load_led_colours()
								json_object["status"] = "0"
							else:
								# Something went wrong when resetting the game admin table
								json_object["status"] = "2"
						else:
							# Something went wrong when resetting the client list
							json_object["status"] = "2"
					else:
						# Something went wrong when resetting the client list
						json_object["status"] = "2"
				else:
					# Something went wrong when truncating tables and resetting auto increment values
					json_object["status"] = "2"

			######### SET BUZZ ENABLE STATE #########
			elif request == "set_buzz_en":

				# Get the required variables
				try: data["buzz_en"]
				except KeyError: data["buzz_en"] = None

				try: data["client_id"]
				except KeyError: data["client_id"] = None

				# Check if variables are provided
				if data["buzz_en"] != None and data["client_id"] != None:

					# Check if variables provided are correct
					if (data["buzz_en"] == 0 or data["buzz_en"] == 1) and (data["client_id"] > 0 and data["client_id"] < 10):

						# Update table with new game state value
						if game_mysql_update("UPDATE tbl_clients SET client_buzz_allowed = %s WHERE client_id = %s;", (str(data["buzz_en"]), str(data["client_id"]))):
							# Everything went well, broadcast that the client list has changed
							if broadcast_en:
								broadcast_msg = {"request": "broadcast", "message": "buzz_en_change", "data": {"client_id": data["client_id"], "buzz_en_state": data["buzz_en"]}}
								self.game_controller_broadcast(broadcast_msg)
							# Update LEDs
							load_led_colours()
							json_object["status"] = "0"
						else:
							# Couldn't update client data
							json_object["status"] = "2"

					else:
						# Variables Error
						json_object["status"] = "3"

				else:
					# Missing Variables
					json_object["status"] = "3"

			######### SET BUZZ SOUND #########
			elif request == "set_buzz_sound":

				# Get the required variables
				try: data["buzz_sound"]
				except KeyError: data["buzz_sound"] = None

				try: data["client_id"]
				except KeyError: data["client_id"] = None

				# Check if variables are provided
				if data["buzz_sound"] != None and data["client_id"] != None:

					# Check if variables provided are correct
					if (data["buzz_sound"] >= 0 and data["buzz_sound"] <= 16) and (data["client_id"] > 0 and data["client_id"] < 10):

						# Update table with new game state value
						if game_mysql_update("UPDATE tbl_clients SET client_sound = %s WHERE client_id = %s;", (str(data["buzz_sound"]), str(data["client_id"]))):
							# Everything went well, broadcast that the client list has changed
							if broadcast_en:
								broadcast_msg = {"request": "broadcast", "message": "client_list_change"}
								self.game_controller_broadcast(broadcast_msg)
							json_object["status"] = "0"
						else:
							# Couldn't update client data
							json_object["status"] = "2"

					else:
						# Variables Error
						json_object["status"] = "3"

				else:
					# Missing Variables
					json_object["status"] = "3"


			######### UNKNOWN REQUEST #########
			else:
				# Unknow request
				json_object["status"] = "5"

		else: 
			# MySQL Error
			json_object["status"] = "1"

		# Return the result
		return json_object
from apa102 import APA102
import time

from game_websockets import *

# Hardware config
NUM_LEDS = 28
PIN_DAT = 15
PIN_CLK = 14
PIN_SEL = None

# Colours definition
colors = [
	(0, 0, 0), 
	(255, 0, 255),
	(0, 255, 255),
	(255, 0, 0),
	(0, 0, 255),
	(0, 255, 0),
	(255, 255, 0),
	(255, 255, 255)
]

# All LEDs off initially
leds_state = [0, 0, 0, 0, 0, 0, 0]
# Button/LED Order
button_led_order = [0, 0, 0, 0, 0, 0, 0]

lights = APA102(NUM_LEDS, PIN_DAT, PIN_CLK, PIN_SEL, brightness=0.2)

def return_colour_index(colour_l):
	
	if colour_l == 'r':
		return 3
	elif colour_l == 'b':
		return 4
	elif colour_l == 'g':
		return 5
	elif colour_l == 'y':
		return 6
	elif colour_l == 'w':
		return 7

def load_led_colours():

	# Load game admin data
	game_admin_rows, admin_data = game_mysql_select("SELECT * FROM tbl_game_admin WHERE game_id = 1 LIMIT 1;", None)
	
	if game_admin_rows == 1:
		# Load client list
		no_clients, client_list = game_mysql_select("SELECT * FROM tbl_clients;", None)
		
		if no_clients >= 0:
			# First update our LED/Buttons order list
			button_led_i = 0;

			for client in client_list:
				if client['client_colour'] != None:
					button_led_order[button_led_i] = client['client_colour'];
					button_led_i += 1

			# Check if the game has started or not
			if admin_data[0]['game_in_progress'] == 1:
				# Game has started
				leds_state[0] = 1

				if admin_data[0]['game_state'] == 0:
					# Waitig for buzz
					leds_state[1] = 0
			
				else:
					# Someone has buzzed
					leds_state[1] = 2
			else:
				# Game is stopped
				leds_state[0] = 0
				leds_state[1] = 0

			# Set Client LEDs to 'Buzz En'
			led_i = 2
			for client in client_list:
				if client['client_colour'] != None:
					if client['client_buzz_allowed'] == 1:
						leds_state[led_i] = return_colour_index(client['client_colour'])
					
					else:
						leds_state[led_i] = 0

					led_i += 1

			# Turn off remaining LEDs
			for i in range(led_i, 7):
				leds_state[i] = 0

			# Show LEDs
			set_leds()

		else:
			# Couldn't get client list
			print("Error getting Client List")
	
	else:
		# Couldn't get game admin data
		print("Error getting Game Admin Data")

def set_leds():

	set_button_colour(0, *colors[leds_state[0]])
	set_button_colour(1, *colors[leds_state[1]])
	set_button_colour(6, *colors[leds_state[2]])
	set_button_colour(5, *colors[leds_state[3]])
	set_button_colour(4, *colors[leds_state[4]])
	set_button_colour(3, *colors[leds_state[5]])
	set_button_colour(2, *colors[leds_state[6]])

def set_button_colour (button, r, g, b):

	for i in range(4):
		lights.set_pixel(i + (4 * button), r, g, b);
	
	lights.show()

def flash_leds (colour_l):

	# Get colour to flash
	flash_colour = return_colour_index(colour_l)

	for j in range(10):
		for i in range(2,7):
			set_button_colour(i, *colors[0])
		time.sleep(0.05)
		
		for i in range(2,7):
			set_button_colour(i, *colors[flash_colour])
		time.sleep(0.05)

	# Revert the LEDs back to the correct value
	load_led_colours()

# Include python libraries
import time
import json
import requests
import RPi.GPIO as GPIO
from datetime import timedelta

# Include local files
from game_websockets import *
from game_leds import *

app = tornado.web.Application([
	(r"/", WebSocketHandler),
])

if __name__ == '__main__':
	
	# Set the initial LEDs
	load_led_colours()

	server = tornado.httpserver.HTTPServer(app)
	server.listen(8080)
	tornado.ioloop.IOLoop.instance().add_timeout(timedelta(milliseconds=10), WebSocketHandler.periodic_button_handler, WebSocketHandler)
	tornado.ioloop.IOLoop.instance().add_timeout(timedelta(milliseconds=50), WebSocketHandler.periodic_winner_check, WebSocketHandler)
	tornado.ioloop.IOLoop.instance().start()

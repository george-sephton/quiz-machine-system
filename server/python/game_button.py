import threading
import time
import RPi.GPIO as GPIO

# Set buttons
GPIO.setmode(GPIO.BCM)

class Button(threading.Thread):

	def __init__(self, channel):
		threading.Thread.__init__(self)
		self._pressed = False
		self.channel = channel

		GPIO.setup(self.channel, GPIO.IN, pull_up_down=GPIO.PUD_UP)

		self.daemon = True
		self.start()

	def pressed(self):
		if self._pressed:
			self._pressed = False
			return True
		
		else:
			return False

	def run(self):
		previous = None
		
		while 1:
			current = GPIO.input(self.channel)
			time.sleep(0.01)

			if current == False and previous == True:
				self._pressed = True

				while self._pressed:
					time.sleep(0.05)

			previous = current
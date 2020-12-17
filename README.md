# George\'s Quiz Machine System

This is all the software for my quiz machine system. Build video can be seen here:

[https://www.youtube.com/watch?v=r20R_foZP2M](https://www.youtube.com/watch?v=r20R_foZP2M "Quiz Machine Hardware Builld")

------------

## File List
### Server - Raspberry Pi

- server/python/ - runs a websockets server and controls the game, also controls the buttons, LEDs and sounds on the quiz master's controller.
- server/www/ - game admin webpage.
 - requires PHP
- server/db_games.sql - SQL script to setup MySQL database to store game info.

### Client - Arduino MKR WiFi 1010

- clients/arduino/ - runs a websocket client to control the player and controls the button and LED on the player's buzzer.

*Note: buzz sounds have been removed due to license*
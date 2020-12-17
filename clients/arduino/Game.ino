#include <SPI.h>
#include <Wire.h>
#include <SAMDTimerInterrupt.h>
#include <ArduinoJson.h>
#include <WiFiNINA_Generic.h>
#include <WebSocketsClient_Generic.h>

#include "arduino_secrets.h"

#define WEBSOCKETS_NETWORK_TYPE     NETWORK_WIFININA

#define WS_SERVER                   "192.168.1.170"
#define WS_PORT                     8080

/* Device specifics */
const char client_colour = 'r'; /* Red */
//const char client_colour = 'b'; /* Blue */
//const char client_colour = 'g'; /* Green */
//const char client_colour = 'y'; /* Yellow */
//const char client_colour = 'w'; /* White */

/* Pin definitions */
const int client_led = 9;
const int client_button = 8;

/* Game mechanics */
int client_id = 0;
int game_in_progress = 0;
int game_state = 0;
int buzz_en = 0;

/* Websockets client */
WebSocketsClient webSocket;
bool alreadyConnected = false;

/* Current charging status */
byte charging_status = 0;

/* Wifi definitions */
char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
int status = WL_IDLE_STATUS;

enum client_status {
    CLIENT_START,
    CLIENT_WIFI_CONNECT,
    CLIENT_SERVER_CONNECT,
    CLIENT_UNREGISTERED,
    CLIENT_REGISTERED,
    CLIENT_WINNER,
    CLIENT_FATAL_ERROR
} global_client_status;

/* Timer variables */
SAMDTimer ITimer(TIMER_TC3);
int timer_count = 0;

void TimerHandler(void)
{
    timer_count++;

    switch(global_client_status) {
        case CLIENT_START:
            if(!(timer_count % 1500)) {
                digitalWrite(client_led, !digitalRead(client_led));
            }
            break;
        case CLIENT_WIFI_CONNECT:
            if(!(timer_count % 1000)) {
                digitalWrite(client_led, !digitalRead(client_led));
            }
            break;
        case CLIENT_SERVER_CONNECT:
            if(!(timer_count % 500)) {
                digitalWrite(client_led, !digitalRead(client_led));
            }
            break;
        case CLIENT_UNREGISTERED:
            if(!(timer_count % 200)) {
                digitalWrite(client_led, 0);
            }
            if(!(timer_count % 1000)) {
                digitalWrite(client_led, 1);
            }
            break;
        case CLIENT_REGISTERED:
            if((buzz_en) && (game_in_progress) && (!game_state)) {
                digitalWrite(client_led, 1);
            } else {
                digitalWrite(client_led, 0);
            }
            break;
        case CLIENT_FATAL_ERROR:
            if(!(timer_count % 50)) {
                digitalWrite(client_led, 0);
            }
            if(!(timer_count % 1000)) {
                digitalWrite(client_led, 1);
            }
            break;
    }

    if(timer_count >= 10000) {
        timer_count = 0;
    }
}


void webSocketEvent(WStype_t type, uint8_t * payload, size_t length)
{
    int i;
    
    switch (type)
    {
        case WStype_DISCONNECTED:
            //Serial.println("Disconnected from server");
            global_client_status = CLIENT_SERVER_CONNECT;
            break;
            
        case WStype_CONNECTED:
            //Serial.println("Connected to server");
            global_client_status = CLIENT_UNREGISTERED;
            webSocket.sendTXT("{\"request\": \"register_self\", \"client_id\": \"\", \"data\": {\"client_colour\": \""+String(client_colour)+"\", \"battery_charge\": \""+String(charging_status)+"\"}}");
            break;
            
        case WStype_TEXT:
            StaticJsonDocument<200> doc;
            StaticJsonDocument<200> doc2;

            //Serial.print("Message received: ");
            //Serial.println((char *) payload);
            
            DeserializationError error = deserializeJson(doc, payload);
            if (!error) {
                 const char* ws_request = doc["request"];
                 int ws_status = doc["status"];
                 const char* ws_result = doc["result"];
                 const char* ws_data = doc["data"];
                 
                 /* Broadcast */
                 if (!strcmp(ws_request, "broadcast")) {
                    if (!strcmp(ws_data, "reset")) {
                        global_client_status = CLIENT_UNREGISTERED;
                        webSocket.sendTXT("{\"request\": \"register_self\", \"client_id\": \"\", \"data\": {\"client_colour\": \""+String(client_colour)+"\", \"battery_charge\": \""+String(charging_status)+"\"}}");
                    }else if (!strcmp(ws_data, "game_admin_change")) {
                        /* Get the game status */
                        webSocket.sendTXT("{\"request\": \"get_admin_data\", \"client_id\": \""+String(client_id)+"\"}");
                    } else if (!strcmp(ws_data, "client_list_change")) {
                        /* Get the buzz en status */
                        webSocket.sendTXT("{\"request\": \"get_buzz_en\", \"client_id\": \""+String(client_id)+"\"}");
                    } else if (!strcmp(ws_data, "buzz_in")) {
                        int ws_client_id = doc["client_id"];
                        if(ws_client_id == client_id) {
                            /* We Won! */
                            global_client_status = CLIENT_WINNER;
                            for(i=0; i<20; i++) {
                                digitalWrite(client_led, !digitalRead(client_led));
                                delay(200);
                            }
                            digitalWrite(client_led, 1);
                            global_client_status = CLIENT_REGISTERED;
                        } else {
                            //Serial.println("Loser");
                            digitalWrite(client_led, 0);
                        }
                        game_state = 1;
                    }
                 /* Registration Response */
                 } else if (!strcmp(ws_request, "register_self")) {
                    if(ws_status == 0) {
                        //Serial.println("Registered successfully");
                        /* Save our client ID */
                        client_id = doc["result"];
                        global_client_status = CLIENT_REGISTERED;

                        /* Get the game status */
                        webSocket.sendTXT("{\"request\": \"get_admin_data\", \"client_id\": \""+String(client_id)+"\"}");
                        /* Get the buzz enabled status */
                        webSocket.sendTXT("{\"request\": \"get_buzz_en\", \"client_id\": \""+String(client_id)+"\"}");
                    } else {
                        //Serial.println("Registered failed");
                    }
                } else if (!strcmp(ws_request, "get_admin_data")) {
                    /* Update the game admin data variables */
                    game_in_progress = doc["result"]["game_in_progress"];
                    game_state = doc["result"]["game_state"];
                } else if (!strcmp(ws_request, "get_buzz_en")) {
                    /* Update the buzz enable variable */
                    buzz_en = doc["result"];
                }
                                 
            } else {
                //Serial.print("deserializeJson() failed: ");
                //Serial.println(error.f_str());
            }
            break;
    }
}

void setup() {
    int i;
    
    pinMode(client_led, OUTPUT);
    pinMode(client_button, INPUT_PULLUP);
    digitalWrite(client_led, 1);

    /* Initialise i2c bus - used for battery charge monitoring */
    Wire.begin(); 

    /* Initialise Serial port - used for debugging */
    //Serial.begin(115200);

    /* Add delay to allow user to plug in USB cable */
    delay(1500);

    /* Get current charge status - do it a few times as the first result on power on is usually wrong */
    for(i=0;i<5;i++)
        get_battery_charging_status();

    /* LED Off */
    digitalWrite(client_led, 0);
    
    /* Initialise hardware timer */
    ITimer.attachInterruptInterval(1000, TimerHandler);
    
    global_client_status = CLIENT_START;

    /* Initialise WiFi */
    if(!wifi_init()) {
        fatal_error();
    }
    global_client_status = CLIENT_WIFI_CONNECT;

    /* Connect to Websockets server */
    webSocket.begin(WS_SERVER, WS_PORT, "/");

    /* Set websockets event handler */
    webSocket.onEvent(webSocketEvent);
  
    global_client_status = CLIENT_SERVER_CONNECT;
}

void loop()
{
    webSocket.loop();

    if((buzz_en) && (game_in_progress) && (!game_state)) {
        if(!digitalRead(client_button)) {
            webSocket.sendTXT("{\"request\": \"buzz_in\", \"client_id\": \""+String(client_id)+"\"}");
            while(!digitalRead(client_button))
            delay(20);
        }
    }
}

void fatal_error() {
    //Serial.println("Fatal Error");
    global_client_status = CLIENT_FATAL_ERROR;
    while(1);
}

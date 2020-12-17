bool wifi_init(void) {
    int wifi_connect_timeout = 0;
    
    if (WiFi.status() == WL_NO_SHIELD) {
        Serial.println("WiFi shield not present");
        return false;
    }

    Serial.print("Attempting to connect to WiFi");
    while (status != WL_CONNECTED) {
        status = WiFi.begin(ssid, pass);
        delay(1000);
        wifi_connect_timeout++;

        if(wifi_connect_timeout >= 30) {
            /* 30 seconds and no WiFi connection */
            return false;
        }
    }
    return true;
}

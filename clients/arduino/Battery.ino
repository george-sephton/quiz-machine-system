void get_battery_charging_status() {
    byte bq24195_status;

    /* Read System Status register from BQ24195L */
    Wire.beginTransmission(0x6B);
    Wire.write(byte(0x08));
    Wire.requestFrom(0x6B,1);
    while(Wire.available())
    {
        bq24195_status = Wire.read();
    }
    Wire.endTransmission();

    charging_status = ((bq24195_status & 0x30) >> 4);
}

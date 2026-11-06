from fog import Forecast, Reading


def test_records_humid_readings_once():
    forecast = Forecast()
    reading = Reading("ridge-01", visibility=400, humidity=0.98)
    assert forecast.record(reading)
    assert not forecast.record(reading)


def test_reports_foggy_ridges():
    forecast = Forecast()
    forecast.record(Reading("ridge-02", visibility=250, humidity=0.99))
    assert forecast.foggy() == ["ridge-02: 250 m\n"]

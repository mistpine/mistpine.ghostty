# fog

Fog forecasts for **ridge-top** weather stations: record readings, then ask
which ridges are under the [fog limit](#limits).

## Usage

```python
from fog import Forecast, Reading

forecast = Forecast(region="mistpine")
forecast.record(Reading("ridge-02", visibility=250, humidity=0.99))
print(forecast.foggy())  # ['ridge-02: 250 m\n']
```

## Limits

| Setting     | Default | Meaning                         |
| ----------- | ------- | ------------------------------- |
| `FOG_LIMIT` | `1000`  | Visibility in metres, exclusive |
| `max_age`   | `3600`  | Seconds a reading stays fresh   |

> [!NOTE]
> Readings below 95% humidity are ignored.

### To do

- [x] Record readings per station
- [ ] Drop readings older than `max_age`
- [ ] Forecast by _region_

"""Fog forecasts for the ridge-top weather stations."""

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

FOG_LIMIT = 1_000  # metres of visibility
RIDGE = re.compile(r"^ridge-(\d{2})$")


@dataclass(frozen=True)
class Reading:
    station: str
    visibility: float
    humidity: float
    at: datetime = field(default_factory=datetime.now)


class Forecast:
    """Keeps the latest reading per station and reports the foggy ones."""

    def __init__(self, region: str = "mistpine", max_age: int = 3600) -> None:
        self.region = region
        self.max_age = timedelta(seconds=max_age)
        self._seen: dict[str, Reading] = {}

    def record(self, reading: Reading) -> bool:
        if reading.humidity < 0.95 or reading.station in self._seen:
            return False
        self._seen[reading.station] = reading
        return True

    def foggy(self, now: datetime | None = None) -> list[str]:
        now = now or datetime.now()
        return [
            f"{r.station}: {r.visibility:.0f} m\n"
            for r in self._seen.values()
            if RIDGE.match(r.station) and r.visibility < FOG_LIMIT
        ]

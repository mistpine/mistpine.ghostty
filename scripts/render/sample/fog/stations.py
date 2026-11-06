"""Ridge-top stations and where to find them."""

STATIONS = {
    "ridge-01": (46.52, 8.07),
    "ridge-02": (46.55, 8.12),
    "ridge-07": (46.61, 8.30),
}


def coordinates(station: str) -> tuple[float, float] | None:
    return STATIONS.get(station)

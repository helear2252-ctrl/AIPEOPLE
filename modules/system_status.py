import psutil
import time

class SystemStatus:
    """
    Retrieves system performance stats (CPU, RAM, latency metrics).
    """
    def __init__(self):
        self.start_time = time.time()

    def get_metrics(self) -> dict:
        uptime = int(time.time() - self.start_time)
        return {
            "uptime_seconds": uptime,
            "uptime_human": f"{uptime // 3600}h {(uptime % 3600) // 60}m {uptime % 60}s",
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_percent": psutil.virtual_memory().percent,
            "api_status": "Operational"
        }

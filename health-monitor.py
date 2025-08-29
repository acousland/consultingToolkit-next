"""
Health monitoring and error detection for the consulting toolkit.
Run this to continuously monitor application health.
"""

import requests
import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Any

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class HealthMonitor:
    def __init__(self):
        self.backend_url = "http://localhost:8000"
        self.frontend_url = "http://localhost:3000" 
        self.critical_endpoints = [
            "/health",
            "/ai/brand/style-guide",
            "/ai/brand/deck", 
            "/ai/brand/analyse",
            "/ai/extract-pain-points"
        ]
        self.frontend_routes = [
            "/",
            "/brand/brand-consistency-checker",
            "/pain-points",
            "/applications/capabilities"
        ]
        
    def check_backend_health(self) -> Dict[str, Any]:
        """Check backend health and critical endpoints."""
        results = {"healthy": True, "errors": []}
        
        try:
            # Test health endpoint
            response = requests.get(f"{self.backend_url}/health", timeout=5)
            if response.status_code != 200:
                results["healthy"] = False
                results["errors"].append(f"Health endpoint returned {response.status_code}")
            
            # Test critical endpoints (should return 422 for empty requests)
            for endpoint in self.critical_endpoints[1:]:  # Skip health endpoint
                try:
                    response = requests.post(
                        f"{self.backend_url}{endpoint}", 
                        json={}, 
                        timeout=5
                    )
                    if response.status_code not in [422, 200]:
                        results["errors"].append(f"{endpoint} returned unexpected status {response.status_code}")
                        results["healthy"] = False
                except requests.RequestException as e:
                    results["errors"].append(f"{endpoint} failed: {str(e)}")
                    results["healthy"] = False
                    
        except requests.RequestException as e:
            results["healthy"] = False
            results["errors"].append(f"Backend unreachable: {str(e)}")
            
        return results
        
    def check_frontend_health(self) -> Dict[str, Any]:
        """Check frontend accessibility."""
        results = {"healthy": True, "errors": []}
        
        for route in self.frontend_routes:
            try:
                response = requests.get(f"{self.frontend_url}{route}", timeout=10)
                if response.status_code != 200:
                    results["healthy"] = False
                    results["errors"].append(f"Route {route} returned {response.status_code}")
            except requests.RequestException as e:
                results["healthy"] = False
                results["errors"].append(f"Route {route} failed: {str(e)}")
                
        return results
        
    def run_health_check(self) -> bool:
        """Run complete health check and log results."""
        logger.info("🔍 Running health check...")
        
        backend_health = self.check_backend_health()
        frontend_health = self.check_frontend_health()
        
        overall_healthy = backend_health["healthy"] and frontend_health["healthy"]
        
        if overall_healthy:
            logger.info("✅ All systems healthy")
        else:
            logger.error("❌ System issues detected:")
            for error in backend_health["errors"] + frontend_health["errors"]:
                logger.error(f"   • {error}")
                
        return overall_healthy
        
    def monitor_continuously(self, interval_seconds: int = 300):
        """Continuously monitor system health."""
        logger.info(f"🚀 Starting continuous monitoring (every {interval_seconds}s)")
        
        while True:
            try:
                self.run_health_check()
                time.sleep(interval_seconds)
            except KeyboardInterrupt:
                logger.info("🛑 Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Monitor error: {str(e)}")
                time.sleep(30)  # Wait before retrying

if __name__ == "__main__":
    import sys
    
    monitor = HealthMonitor()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        monitor.monitor_continuously()
    else:
        # Single health check
        healthy = monitor.run_health_check()
        sys.exit(0 if healthy else 1)

#!/usr/bin/env python3

import requests
import time
import sys
import subprocess
import os

# Set environment
os.environ['PYTHONPATH'] = '/Users/acousland/Documents/Code/consultingToolkit-next/backend'

# Start the backend server
backend_process = subprocess.Popen([
    '/Users/acousland/Documents/Code/consultingToolkit-next/.venv/bin/python', 
    '-m', 'uvicorn', 
    'app.main:app', 
    '--host', '127.0.0.1', 
    '--port', '8000'
], cwd='/Users/acousland/Documents/Code/consultingToolkit-next/backend')

print("Starting backend server...")
time.sleep(3)  # Wait for server to start

try:
    # Test ping endpoint
    response = requests.get("http://127.0.0.1:8000/ai/ping", timeout=5)
    print(f"Ping response: {response.status_code} - {response.text}")
    
    # Test if our new endpoint exists
    test_files = {
        'applications': ('test.csv', 'id,name\n1,App1\n'),
        'capabilities': ('test.csv', 'id,name\n1,Cap1\n'),
        'pain_point_mapping': ('test.csv', 'pp_id,desc,cap_id\n1,Test,1\n'),
        'application_mapping': ('test.csv', 'app_id,cap_id\n1,1\n')
    }
    
    data = {
        'pain_point_id_col': 'pp_id',
        'pain_point_desc_cols': '["desc"]',
        'capability_id_col': 'cap_id',
        'app_id_col': 'app_id',
        'app_name_col': 'name',
        'cap_id_col': 'id',
        'cap_name_col': 'name'
    }
    
    response = requests.post("http://127.0.0.1:8000/ai/applications/portfolio/analyze-from-files", 
                           files=test_files, data=data, timeout=10)
    print(f"Portfolio endpoint response: {response.status_code}")
    if response.status_code != 200:
        print(f"Error: {response.text}")
    else:
        print("Portfolio endpoint exists and responds!")
        
except Exception as e:
    print(f"Error testing backend: {e}")

finally:
    # Clean up
    backend_process.terminate()
    time.sleep(1)
    if backend_process.poll() is None:
        backend_process.kill()
    print("Backend server stopped.")

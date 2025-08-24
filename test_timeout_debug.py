#!/usr/bin/env python3

import requests
import time
import sys
import subprocess
import os

# Set environment
os.environ['PYTHONPATH'] = '/Users/acousland/Documents/Code/consultingToolkit-next/backend'

def test_single_capability():
    """Test the individual capability analysis endpoint"""
    print("\n🎯 Testing Single Capability Analysis...")
    
    payload = {
        "capability": {
            "id": "CAP001",
            "text_content": "Customer Data Management"
        },
        "related_pain_points": [
            {
                "pain_point_id": "PP001",
                "pain_point_desc": "System is slow during peak hours",
                "capability_id": "CAP001"
            }
        ],
        "affected_applications": [
            {
                "id": "APP001", 
                "text_content": "CRM System"
            }
        ],
        "all_applications": [
            {
                "id": "APP001",
                "text_content": "CRM System"
            }
        ]
    }
    
    try:
        response = requests.post(
            "http://127.0.0.1:8000/ai/applications/portfolio/analyze-capability",
            json=payload,
            timeout=60
        )
        
        print(f"Response Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("✅ Single capability analysis works!")
            print(f"   Capability: {result.get('capability', 'N/A')}")
            print(f"   Priority: {result.get('priority', 'N/A')}")
            print(f"   Recommendation: {result.get('recommendation', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ Failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_minimal_file_upload():
    """Test file upload with minimal data and short timeout"""
    print("\n📁 Testing Minimal File Upload...")
    
    # Create very simple test data
    test_files = {
        'applications': ('apps.csv', 'Application ID,Application Name\nAPP001,Test App\n'),
        'capabilities': ('caps.csv', 'Capability ID,Capability Name\nCAP001,Test Capability\n'),
        'pain_point_mapping': ('pp.csv', 'Pain Point ID,Issue Description,Capability ID\nPP001,Test Issue,CAP001\n'),
        'application_mapping': ('mapping.csv', 'Application ID,Capability ID\nAPP001,CAP001\n')
    }
    
    data = {
        'pain_point_id_col': 'Pain Point ID',
        'pain_point_desc_cols': '["Issue Description"]',
        'capability_id_col': 'Capability ID',
        'app_id_col': 'Application ID',
        'app_name_col': 'Application Name',
        'cap_id_col': 'Capability ID',
        'cap_name_col': 'Capability Name',
        'additional_context': 'Quick test'
    }
    
    try:
        print("Sending request with 10 second timeout...")
        response = requests.post(
            "http://127.0.0.1:8000/ai/applications/portfolio/analyze-from-files",
            files=test_files,
            data=data,
            timeout=10  # Very short timeout
        )
        
        print(f"Response Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ File upload analysis completed quickly!")
            return True
        elif response.status_code == 503:
            print("✅ LLM service unavailable (expected)")
            return True
        else:
            print(f"❌ Unexpected status: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("⚠️  Request timed out after 10 seconds")
        print("   This suggests the LLM processing is taking too long")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Debugging Portfolio Analysis Timeout")
    print("=" * 50)
    
    # Start backend
    backend_process = subprocess.Popen([
        '/Users/acousland/Documents/Code/consultingToolkit-next/.venv/bin/python', 
        '-m', 'uvicorn', 
        'app.main:app', 
        '--host', '127.0.0.1', 
        '--port', '8000'
    ], cwd='/Users/acousland/Documents/Code/consultingToolkit-next/backend')
    
    print("Starting backend server...")
    time.sleep(5)
    
    try:
        # Test basic connectivity
        response = requests.get("http://127.0.0.1:8000/ai/ping", timeout=5)
        if response.status_code != 200:
            print("❌ Backend server not responding")
            return False
        print("✅ Backend server is running")
        
        # Test single capability analysis
        single_works = test_single_capability()
        
        # Test minimal file upload
        file_works = test_minimal_file_upload()
        
        # Summary
        print("\n" + "=" * 50)
        print("🎯 TIMEOUT DEBUG RESULTS:")
        print(f"   {'✅' if single_works else '❌'} Single Capability: {'Works' if single_works else 'Failed'}")
        print(f"   {'✅' if file_works else '⚠️ '} File Upload: {'Works' if file_works else 'Times out'}")
        
        if single_works and not file_works:
            print("\n🔍 DIAGNOSIS: File processing pipeline has performance issues")
            print("   Recommendation: Add timeouts and optimize LLM calls")
        elif not single_works:
            print("\n🔍 DIAGNOSIS: LLM integration has issues")
            print("   Recommendation: Check LLM service configuration")
        else:
            print("\n🎉 DIAGNOSIS: Everything works!")
            
        return single_works
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
        
    finally:
        # Cleanup
        backend_process.terminate()
        time.sleep(2)
        if backend_process.poll() is None:
            backend_process.kill()
        print("\n🧹 Backend server stopped")

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

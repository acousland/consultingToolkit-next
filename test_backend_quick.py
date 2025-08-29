#!/usr/bin/env python3

import requests
import time
import sys
import subprocess
import os
import tempfile
import pandas as pd

# Set environment
os.environ['PYTHONPATH'] = '/Users/acousland/Documents/Code/consultingToolkit-next/backend'

def test_llm_availability():
    """Test if LLM service is configured and available"""
    try:
        response = requests.get("http://127.0.0.1:8000/ai/llm/status", timeout=10)
        if response.status_code == 200:
            status = response.json()
            print(f"✅ LLM Status: {status}")
            return status.get('enabled', False)
        else:
            print(f"⚠️  LLM status check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"⚠️  Cannot check LLM status: {e}")
        return False

def test_endpoint_validation():
    """Test the endpoint validation without LLM processing"""
    print("\n🔍 Testing Endpoint Validation...")
    
    # Test with invalid data to check validation
    test_files = {
        'applications': ('test.csv', 'wrong_col,another_col\nval1,val2\n'),
        'capabilities': ('test.csv', 'id,name\n1,Cap1\n'),
        'pain_point_mapping': ('test.csv', 'pp_id,desc,cap_id\n1,Test,1\n'),
        'application_mapping': ('test.csv', 'app_id,cap_id\n1,1\n')
    }
    
    data = {
        'pain_point_id_col': 'pp_id',
        'pain_point_desc_cols': '["desc"]',
        'capability_id_col': 'cap_id',
        'app_id_col': 'Application ID',  # This should fail - column doesn't exist
        'app_name_col': 'Application Name',  # This should fail - column doesn't exist
        'cap_id_col': 'id',
        'cap_name_col': 'name'
    }
    
    try:
        response = requests.post(
            "http://127.0.0.1:8000/ai/applications/portfolio/analyze-from-files",
            files=test_files, 
            data=data, 
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400 and "Missing columns" in response.text:
            print("✅ Column validation is working correctly!")
            return True
        else:
            print("❌ Validation test failed")
            return False
            
    except Exception as e:
        print(f"❌ Validation test error: {e}")
        return False

def test_valid_data_structure():
    """Test with valid data structure to see how far we get"""
    print("\n📋 Testing Valid Data Structure...")
    
    # Create minimal valid data
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
        'cap_name_col': 'Capability Name'
    }
    
    try:
        response = requests.post(
            "http://127.0.0.1:8000/ai/applications/portfolio/analyze-from-files",
            files=test_files, 
            data=data, 
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response: {response.text[:500]}...")
        
        if response.status_code == 503:
            print("✅ Data parsing succeeded, LLM service unavailable (expected)")
            return True
        elif response.status_code == 200:
            print("✅ Full analysis completed successfully!")
            return True
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Valid data test error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing Portfolio Analysis Backend (Quick Validation)")
    print("=" * 60)
    
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
        
        # Check LLM availability
        llm_available = test_llm_availability()
        
        # Test endpoint validation
        validation_works = test_endpoint_validation()
        
        # Test with valid data structure  
        structure_works = test_valid_data_structure()
        
        # Summary
        print("\n" + "=" * 60)
        print("🎯 TEST SUMMARY:")
        print(f"   ✅ Backend Server: Running")
        print(f"   {'✅' if llm_available else '⚠️ '} LLM Service: {'Available' if llm_available else 'Not configured'}")
        print(f"   {'✅' if validation_works else '❌'} Input Validation: {'Working' if validation_works else 'Failed'}")
        print(f"   {'✅' if structure_works else '❌'} Data Processing: {'Working' if structure_works else 'Failed'}")
        
        overall_success = validation_works and structure_works
        
        if overall_success:
            print("\n🎉 BACKEND IS WORKING CORRECTLY!")
            if not llm_available:
                print("   Note: LLM service is not configured, but the endpoint structure is correct.")
                print("   The backend will work fully once you configure OpenAI API keys.")
        else:
            print("\n💥 BACKEND HAS ISSUES!")
            
        return overall_success
        
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

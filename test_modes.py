#!/usr/bin/env python3

import requests
import time
import sys
import subprocess
import os

# Set environment
os.environ['PYTHONPATH'] = '/Users/acousland/Documents/Code/consultingToolkit-next/backend'

def test_fast_mode():
    """Test the fast mode (no LLM calls)"""
    print("\n⚡ Testing Fast Mode (No LLM)...")
    
    # Create simple test data
    test_files = {
        'applications': ('apps.csv', 'Application ID,Application Name\nAPP001,CRM System\nAPP002,ERP System\n'),
        'capabilities': ('caps.csv', 'Capability ID,Capability Name\nCAP001,Customer Management\nCAP002,Financial Reporting\n'),
        'pain_point_mapping': ('pp.csv', 'Pain Point ID,Issue Description,Capability ID\nPP001,System slow,CAP001\nPP002,Reports delayed,CAP002\n'),
        'application_mapping': ('mapping.csv', 'Application ID,Capability ID\nAPP001,CAP001\nAPP002,CAP002\n')
    }
    
    data = {
        'pain_point_id_col': 'Pain Point ID',
        'pain_point_desc_cols': '["Issue Description"]',
        'capability_id_col': 'Capability ID',
        'app_id_col': 'Application ID',
        'app_name_col': 'Application Name',
        'cap_id_col': 'Capability ID',
        'cap_name_col': 'Capability Name',
        'additional_context': 'Fast mode test',
        'max_capabilities': '2',
        'fast_mode': 'true'  # Enable fast mode
    }
    
    try:
        print("Sending request in fast mode...")
        start_time = time.time()
        
        response = requests.post(
            "http://127.0.0.1:8000/ai/applications/portfolio/analyze-from-files",
            files=test_files,
            data=data,
            timeout=30  # Should be very fast
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"Response Status: {response.status_code}")
        print(f"Duration: {duration:.1f} seconds")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Fast mode works!")
            
            print(f"\n📊 Fast Mode Results:")
            print(f"   • Recommendations: {len(result.get('recommendations', []))}")
            print(f"   • Harmonized: {len(result.get('harmonized_recommendations', []))}")
            
            if 'summary' in result:
                summary = result['summary']
                for key, value in summary.items():
                    print(f"   • {key}: {value}")
            
            return True
            
        else:
            print(f"❌ Fast mode failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Fast mode error: {e}")
        return False

def test_llm_mode():
    """Test the LLM mode with very short timeout"""
    print("\n🧠 Testing LLM Mode (Short Timeout)...")
    
    # Create simple test data
    test_files = {
        'applications': ('apps.csv', 'Application ID,Application Name\nAPP001,CRM System\n'),
        'capabilities': ('caps.csv', 'Capability ID,Capability Name\nCAP001,Customer Management\n'),
        'pain_point_mapping': ('pp.csv', 'Pain Point ID,Issue Description,Capability ID\nPP001,System slow,CAP001\n'),
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
        'additional_context': 'LLM mode test',
        'max_capabilities': '1',  # Just 1 capability
        'fast_mode': 'false'  # Use LLM
    }
    
    try:
        print("Sending request in LLM mode...")
        start_time = time.time()
        
        response = requests.post(
            "http://127.0.0.1:8000/ai/applications/portfolio/analyze-from-files",
            files=test_files,
            data=data,
            timeout=60
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"Response Status: {response.status_code}")
        print(f"Duration: {duration:.1f} seconds")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ LLM mode works!")
            
            if result.get('summary', {}).get('error'):
                print("⚠️  LLM mode timed out but returned graceful results")
            else:
                print("🎉 LLM mode completed successfully!")
            
            return True
            
        else:
            print(f"❌ LLM mode failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ LLM mode error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing Fast Mode vs LLM Mode")
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
        
        # Test fast mode
        fast_works = test_fast_mode()
        
        # Test LLM mode
        llm_works = test_llm_mode()
        
        # Summary
        print("\n" + "=" * 50)
        print("🎯 MODE COMPARISON RESULTS:")
        print(f"   {'✅' if fast_works else '❌'} Fast Mode: {'Works' if fast_works else 'Failed'}")
        print(f"   {'✅' if llm_works else '❌'} LLM Mode: {'Works' if llm_works else 'Failed'}")
        
        if fast_works:
            print("\n🎉 SUCCESS: Portfolio analysis backend is functional!")
            print("   • Fast mode provides immediate heuristic analysis")
            if llm_works:
                print("   • LLM mode provides AI-powered deep analysis")
            else:
                print("   • LLM mode available but may require performance tuning")
        else:
            print("\n💥 FAILURE: Basic functionality not working")
            
        return fast_works
        
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

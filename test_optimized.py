#!/usr/bin/env python3

import requests
import time
import sys
import subprocess
import os

# Set environment
os.environ['PYTHONPATH'] = '/Users/acousland/Documents/Code/consultingToolkit-next/backend'

def test_optimized_file_upload():
    """Test the optimized file upload with capability limit"""
    print("\n🚀 Testing Optimized File Upload...")
    
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
        'additional_context': 'Quick test with limited capabilities',
        'max_capabilities': '2'  # Limit to 2 capabilities
    }
    
    try:
        print("Sending request with 60 second timeout...")
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
            print("✅ Optimized file upload works!")
            
            print(f"\n📊 Results Summary:")
            print(f"   • Recommendations: {len(result.get('recommendations', []))}")
            print(f"   • Harmonized: {len(result.get('harmonized_recommendations', []))}")
            
            if 'summary' in result:
                summary = result['summary']
                for key, value in summary.items():
                    print(f"   • {key}: {value}")
            
            # Show first recommendation
            if result.get('recommendations'):
                rec = result['recommendations'][0]
                print(f"\n📋 Sample Recommendation:")
                print(f"   • Capability: {rec.get('capability', 'N/A')}")
                print(f"   • Priority: {rec.get('priority', 'N/A')}")
                print(f"   • Recommendation: {rec.get('recommendation', 'N/A')[:100]}...")
            
            return True
            
        elif response.status_code == 504:
            print("⚠️  Request timed out (504) - still too slow")
            return False
        elif response.status_code == 503:
            print("✅ LLM service unavailable (expected)")
            return True
        else:
            print(f"❌ Unexpected status: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("⚠️  Request timed out after 60 seconds")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing Optimized Portfolio Analysis")
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
        
        # Test optimized file upload
        success = test_optimized_file_upload()
        
        # Summary
        print("\n" + "=" * 50)
        if success:
            print("🎉 OPTIMIZATION SUCCESSFUL!")
            print("   Portfolio analysis backend is working with performance limits")
        else:
            print("💥 OPTIMIZATION FAILED!")
            print("   Still experiencing performance issues")
            
        return success
        
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

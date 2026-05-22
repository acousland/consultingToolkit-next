#!/usr/bin/env python3
"""
Backend dependency checker and installer for Consulting Toolkit
This script ensures all required Python packages are installed before starting the backend
"""

import subprocess
import sys
import os
import importlib.util

# Required packages for the backend
REQUIRED_PACKAGES = [
    'fastapi',
    'uvicorn',
    'pydantic', 
    'python-multipart',
    'pandas',
    'openpyxl',
    'xlsxwriter',
    'xlrd',
    'langchain',
    'langchain-openai',
    'openai',
    'redis',
    'celery',
    'rq',
    'python-dotenv',
    'pytest',
    'pytest-asyncio',
    'PyMuPDF'
]

def check_package_installed(package_name):
    """Check if a package is already installed"""
    try:
        # Handle packages with different import names
        import_name = package_name
        if package_name == 'python-multipart':
            import_name = 'multipart'
        elif package_name == 'python-dotenv':
            import_name = 'dotenv'
        elif package_name == 'PyMuPDF':
            import_name = 'fitz'
        elif package_name == 'langchain-openai':
            import_name = 'langchain_openai'
            
        spec = importlib.util.find_spec(import_name)
        return spec is not None
    except ImportError:
        return False

def install_package(package_name):
    """Install a package using pip"""
    try:
        print(f"📦 Installing {package_name}...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--user', package_name], 
                      check=True, capture_output=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install {package_name}: {e}")
        return False

def main():
    """Main function to check and install dependencies"""
    print("🔍 Checking backend dependencies for Consulting Toolkit...")
    
    missing_packages = []
    
    # Check which packages are missing
    for package in REQUIRED_PACKAGES:
        if not check_package_installed(package):
            missing_packages.append(package)
    
    if not missing_packages:
        print("✅ All required packages are already installed!")
        return True
    
    print(f"📋 Found {len(missing_packages)} missing packages: {', '.join(missing_packages)}")
    
    # Install missing packages
    failed_packages = []
    for package in missing_packages:
        if not install_package(package):
            failed_packages.append(package)
    
    if failed_packages:
        print(f"❌ Failed to install {len(failed_packages)} packages: {', '.join(failed_packages)}")
        print("You may need to install them manually or check your Python setup.")
        return False
    
    print("✅ All backend dependencies installed successfully!")
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

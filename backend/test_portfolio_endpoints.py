#!/usr/bin/env python3
"""
Test script for the new portfolio analysis endpoints.
Run this after starting the backend server to verify the new endpoints work.
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL
BASE_URL = "http://localhost:8000"

def test_llm_health():
    """Test if LLM is available"""
    print("Testing LLM health...")
    try:
        response = requests.get(f"{BASE_URL}/ai/llm/health")
        if response.status_code == 200:
            print("✓ LLM is available and healthy")
            return True
        else:
            print(f"✗ LLM health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ LLM health check error: {e}")
        return False

def test_llm_chat():
    """Test the general LLM chat endpoint"""
    print("\nTesting LLM chat endpoint...")
    try:
        payload = {
            "messages": [
                {"role": "user", "content": "Say exactly 'Hello, portfolio analysis!'"}
            ]
        }
        response = requests.post(f"{BASE_URL}/ai/llm/chat", json=payload)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ LLM chat works: {result.get('response', '')[:50]}...")
            return True
        else:
            print(f"✗ LLM chat failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ LLM chat error: {e}")
        return False

def test_capability_analysis():
    """Test individual capability analysis"""
    print("\nTesting capability analysis endpoint...")
    try:
        payload = {
            "capability": {
                "id": "CAP-001",
                "text_content": "Customer relationship management and customer data handling"
            },
            "related_pain_points": [
                {
                    "pain_point_id": "PP-001",
                    "pain_point_desc": "Customer data is scattered across multiple systems",
                    "capability_id": "CAP-001"
                }
            ],
            "affected_applications": [
                {
                    "id": "APP-001",
                    "text_content": "CRM system for customer management"
                }
            ],
            "all_applications": [
                {
                    "id": "APP-001",
                    "text_content": "CRM system for customer management"
                },
                {
                    "id": "APP-002",
                    "text_content": "Marketing automation platform"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/ai/applications/portfolio/analyze-capability", json=payload)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Capability analysis works: {result.get('capability', '')} - {result.get('priority', '')}")
            return result
        else:
            print(f"✗ Capability analysis failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"✗ Capability analysis error: {e}")
        return None

def test_harmonization(recommendations):
    """Test recommendation harmonization"""
    print("\nTesting harmonization endpoint...")
    try:
        payload = {
            "recommendations": [recommendations] if recommendations else [],
            "applications": [
                {
                    "id": "APP-001",
                    "text_content": "CRM system for customer management"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/ai/applications/portfolio/harmonize", json=payload)
        if response.status_code == 200:
            result = response.json()
            harmonized = result.get('harmonized_recommendations', [])
            if harmonized:
                print(f"✓ Harmonization works: {len(harmonized)} applications harmonized")
                return True
            else:
                print("✓ Harmonization endpoint works but no applications to harmonize")
                return True
        else:
            print(f"✗ Harmonization failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Harmonization error: {e}")
        return False

def test_full_portfolio_analysis():
    """Test the complete portfolio analysis workflow"""
    print("\nTesting complete portfolio analysis...")
    try:
        payload = {
            "capabilities": [
                {
                    "id": "CAP-001",
                    "text_content": "Customer relationship management"
                }
            ],
            "applications": [
                {
                    "id": "APP-001",
                    "text_content": "CRM system for customer management"
                }
            ],
            "pain_point_mappings": [
                {
                    "pain_point_id": "PP-001",
                    "pain_point_desc": "Customer data fragmentation",
                    "capability_id": "CAP-001"
                }
            ],
            "application_mappings": [
                {
                    "id": "APP-001",
                    "text_content": "CRM system handles customer relationship management"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/ai/applications/portfolio/analyze", json=payload)
        if response.status_code == 200:
            result = response.json()
            recommendations = result.get('recommendations', [])
            harmonized = result.get('harmonized_recommendations', [])
            summary = result.get('summary', {})
            print(f"✓ Full analysis works: {len(recommendations)} recommendations, {len(harmonized)} harmonized")
            print(f"  Summary: {summary}")
            return True
        else:
            print(f"✗ Full analysis failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Full analysis error: {e}")
        return False

def main():
    """Run all tests"""
    print("Portfolio Analysis Backend Test Suite")
    print("=" * 50)
    
    # Test LLM availability first
    if not test_llm_health():
        print("\n❌ LLM is not available. Please ensure:")
        print("   1. Backend server is running")
        print("   2. OpenAI API key is configured")
        print("   3. LLM service is properly initialized")
        sys.exit(1)
    
    # Test individual endpoints
    chat_works = test_llm_chat()
    capability_result = test_capability_analysis()
    harmonization_works = test_harmonization(capability_result)
    full_analysis_works = test_full_portfolio_analysis()
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST SUMMARY:")
    print(f"✓ LLM Health: {'PASS' if True else 'FAIL'}")
    print(f"✓ LLM Chat: {'PASS' if chat_works else 'FAIL'}")
    print(f"✓ Capability Analysis: {'PASS' if capability_result else 'FAIL'}")
    print(f"✓ Harmonization: {'PASS' if harmonization_works else 'FAIL'}")
    print(f"✓ Full Analysis: {'PASS' if full_analysis_works else 'FAIL'}")
    
    if all([chat_works, capability_result, harmonization_works, full_analysis_works]):
        print("\n🎉 All tests passed! Portfolio analysis backend is ready.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()

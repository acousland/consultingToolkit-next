#!/bin/bash
# Remove duplicate dynamic exports from API route files

find src/app/api -name "route.ts" | while read file; do
    # Count occurrences of dynamic export
    count=$(grep -c "export const dynamic" "$file")
    
    if [ "$count" -gt 1 ]; then
        echo "Fixing duplicates in $file"
        # Keep only the first occurrence
        awk '!seen && /export const dynamic/ {seen=1; print; next} !/export const dynamic/ {print}' "$file" > temp_file
        mv temp_file "$file"
    fi
done

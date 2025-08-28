#!/bin/bash
# Add dynamic export to all API route files

find src/app/api -name "route.ts" | while read file; do
    if ! grep -q "export const dynamic" "$file"; then
        # Create temporary file with dynamic export at the top
        echo "export const dynamic = 'force-dynamic';" > temp_file
        echo "" >> temp_file
        cat "$file" >> temp_file
        mv temp_file "$file"
        echo "Added dynamic export to $file"
    fi
done

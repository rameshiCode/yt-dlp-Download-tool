#!/bin/bash

# Music to USB Copy Script
# This script safely copies your downloaded music collection to USB drive

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOURCE_DIR="./downloads"
USB_MOUNT_POINT="/media/ra/MUSICUSB"
DESTINATION_DIR="$USB_MOUNT_POINT/Music"

echo -e "${BLUE}🎵 Music to USB Copy Tool${NC}"
echo "=================================="

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}❌ Error: Source directory '$SOURCE_DIR' not found!${NC}"
    exit 1
fi

# Check if USB is mounted
if [ ! -d "$USB_MOUNT_POINT" ]; then
    echo -e "${RED}❌ Error: USB drive not found at '$USB_MOUNT_POINT'${NC}"
    echo -e "${YELLOW}💡 Please make sure your USB drive is plugged in and mounted${NC}"
    exit 1
fi

# Check USB space
echo -e "${BLUE}📊 Checking USB drive space...${NC}"
USB_AVAILABLE=$(df -BG "$USB_MOUNT_POINT" | awk 'NR==2 {print $4}' | sed 's/G//')
SOURCE_SIZE=$(du -s "$SOURCE_DIR" | awk '{print int($1/1024/1024)}')

echo -e "${BLUE}📁 Source size: ${SOURCE_SIZE}GB${NC}"
echo -e "${BLUE}💾 USB available: ${USB_AVAILABLE}GB${NC}"

if [ "$SOURCE_SIZE" -gt "$USB_AVAILABLE" ]; then
    echo -e "${RED}❌ Error: Not enough space on USB drive!${NC}"
    echo -e "${YELLOW}💡 Need ${SOURCE_SIZE}GB but only ${USB_AVAILABLE}GB available${NC}"
    exit 1
fi

# Create destination directory
echo -e "${BLUE}📂 Creating destination directory...${NC}"
mkdir -p "$DESTINATION_DIR"

# Function to copy with progress
copy_with_progress() {
    local src="$1"
    local dst="$2"
    local name="$3"
    
    echo -e "${YELLOW}📁 Copying: $name${NC}"
    
    # Use rsync for better progress and resume capability
    rsync -av --progress "$src/" "$dst/" 2>/dev/null || {
        echo -e "${RED}❌ Failed to copy $name${NC}"
        return 1
    }
    
    echo -e "${GREEN}✅ Successfully copied: $name${NC}"
}

# Main copying process
echo -e "${BLUE}🚀 Starting music copy process...${NC}"
echo ""

# Get list of directories and files
TOTAL_ITEMS=0
for item in "$SOURCE_DIR"/*; do
    if [ -e "$item" ]; then
        TOTAL_ITEMS=$((TOTAL_ITEMS + 1))
    fi
done

CURRENT_ITEM=0

# Copy each genre folder and standalone files
for item in "$SOURCE_DIR"/*; do
    if [ -e "$item" ]; then
        CURRENT_ITEM=$((CURRENT_ITEM + 1))
        item_name=$(basename "$item")
        
        echo -e "${BLUE}[$CURRENT_ITEM/$TOTAL_ITEMS]${NC}"
        
        if [ -d "$item" ]; then
            # It's a directory - check if it has content
            if [ "$(ls -A "$item")" ]; then
                copy_with_progress "$item" "$DESTINATION_DIR/$item_name" "$item_name (folder)"
            else
                echo -e "${YELLOW}⚠️  Skipping empty folder: $item_name${NC}"
            fi
        elif [ -f "$item" ]; then
            # It's a file
            echo -e "${YELLOW}📄 Copying file: $item_name${NC}"
            cp "$item" "$DESTINATION_DIR/" && echo -e "${GREEN}✅ Successfully copied: $item_name${NC}" || echo -e "${RED}❌ Failed to copy: $item_name${NC}"
        fi
        echo ""
    fi
done

# Verify copy
echo -e "${BLUE}🔍 Verifying copy...${NC}"
SOURCE_COUNT=$(find "$SOURCE_DIR" -name "*.mp3" | wc -l)
DEST_COUNT=$(find "$DESTINATION_DIR" -name "*.mp3" | wc -l)

echo -e "${BLUE}📊 Copy Summary:${NC}"
echo -e "${BLUE}   Source MP3 files: $SOURCE_COUNT${NC}"
echo -e "${BLUE}   Copied MP3 files: $DEST_COUNT${NC}"

if [ "$SOURCE_COUNT" -eq "$DEST_COUNT" ]; then
    echo -e "${GREEN}🎉 SUCCESS! All music files copied successfully!${NC}"
    echo -e "${GREEN}📁 Your music is now available at: $DESTINATION_DIR${NC}"
    
    # Show folder structure
    echo -e "${BLUE}📂 Folder structure on USB:${NC}"
    tree "$DESTINATION_DIR" 2>/dev/null || ls -la "$DESTINATION_DIR"
    
else
    echo -e "${YELLOW}⚠️  Warning: File count mismatch. Please check manually.${NC}"
fi

# Show USB usage after copy
echo -e "${BLUE}💾 USB drive usage after copy:${NC}"
df -h "$USB_MOUNT_POINT"

echo ""
echo -e "${GREEN}🎵 Music copy completed! Enjoy your portable music collection! 🎵${NC}"

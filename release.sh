#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}xnote Release Script${NC}"
echo "================================"

# Check if version argument provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version argument required${NC}"
    echo "Usage: ./release.sh <version>"
    echo "Example: ./release.sh 1.0.2"
    exit 1
fi

NEW_VERSION=$1

# Confirm version
echo -e "\n${BLUE}Release version: ${GREEN}${NEW_VERSION}${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Update version in package.json
echo -e "\n${BLUE}[1/7] Updating version in package.json...${NC}"
cd app
npm version ${NEW_VERSION} --no-git-tag-version
cd ..

# Commit version bump
echo -e "\n${BLUE}[2/7] Committing version bump...${NC}"
git add app/package.json
git commit -m "Bump version to ${NEW_VERSION}"

# Push to main
echo -e "\n${BLUE}[3/7] Pushing to main...${NC}"
git push

# Create and push tag
echo -e "\n${BLUE}[4/7] Creating and pushing tag v${NEW_VERSION}...${NC}"
git tag v${NEW_VERSION}
git push --tags

# Wait for GitHub Actions to build
echo -e "\n${BLUE}[5/7] Waiting for GitHub Actions to build (checking every 30s)...${NC}"
sleep 30

MAX_ATTEMPTS=10
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    STATUS=$(gh run list --repo unclecode/xnote --limit 1 --json status,conclusion -q '.[0]')
    RUN_STATUS=$(echo $STATUS | jq -r '.status')
    RUN_CONCLUSION=$(echo $STATUS | jq -r '.conclusion')
    
    if [ "$RUN_STATUS" = "completed" ]; then
        if [ "$RUN_CONCLUSION" = "success" ] || [ "$RUN_CONCLUSION" = "failure" ]; then
            echo -e "${GREEN}Build completed${NC}"
            break
        fi
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    echo "Still building... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
    sleep 30
done

# Download release and get SHA256
echo -e "\n${BLUE}[6/7] Downloading release and calculating SHA256...${NC}"
gh release download v${NEW_VERSION} --repo unclecode/xnote --pattern "*.zip" --dir /tmp --clobber
SHA256=$(shasum -a 256 /tmp/xnote-${NEW_VERSION}-mac-universal.zip | awk '{print $1}')
echo -e "SHA256: ${GREEN}${SHA256}${NC}"

# Update Homebrew tap
echo -e "\n${BLUE}[7/7] Updating Homebrew tap...${NC}"
cd /tmp
if [ ! -d "homebrew-xnote" ]; then
    git clone git@github.com:unclecode/homebrew-xnote.git
fi
cd homebrew-xnote
git pull

cat > Casks/xnote.rb << CASKEOF
cask "xnote" do
  version "${NEW_VERSION}"
  sha256 "${SHA256}"

  url "https://github.com/unclecode/xnote/releases/download/v#{version}/xnote-#{version}-mac-universal.zip"
  name "xnote"
  desc "Minimalist note-taking app for macOS"
  homepage "https://github.com/unclecode/xnote"

  app "xnote.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/xnote.app"],
                   sudo: false
  end

  zap trash: [
    "~/.xnote",
  ]
end
CASKEOF

git add Casks/xnote.rb
git commit -m "Update xnote to v${NEW_VERSION}"
git push

echo -e "\n${GREEN}✓ Release ${NEW_VERSION} complete!${NC}"
echo -e "\nUsers can now update with: ${BLUE}brew upgrade xnote${NC}"
echo -e "Release page: ${BLUE}https://github.com/unclecode/xnote/releases/tag/v${NEW_VERSION}${NC}"

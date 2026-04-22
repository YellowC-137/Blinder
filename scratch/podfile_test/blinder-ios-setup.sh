#!/bin/bash
# Blinder iOS Setup Script
# This script helps integrate .env into your Xcode project.

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found. Please run 'blinder blind' first."
    exit 1
fi

echo "🛡️ Blinder - Integrating .env with Xcode Info.plist"

# 1. Check for PlistBuddy
if ! command -v /usr/libexec/PlistBuddy &> /dev/null; then
    echo "❌ PlistBuddy not found. This script requires macOS."
    exit 1
fi

# 2. Instructions
echo ""
echo "To automatically load .env into your app, follow these steps in Xcode:"
echo "1. Open your project in Xcode."
echo "2. Select your Target -> Build Phases -> + -> New Run Script Phase."
echo "3. Name it 'Blinder Env Loader' and move it to the VERY END of the Build Phases (below 'Copy Bundle Resources')."
echo "4. Paste the following script into the phase:"
echo ""
echo "----------------------------------------------------------------"
cat << 'EOF'
# --- Blinder Run Script Start ---
# Support both Native iOS and Flutter project structures
if [ -f "${SRCROOT}/.env" ]; then
    ENV_FILE="${SRCROOT}/.env"
elif [ -f "${SRCROOT}/../.env" ]; then
    ENV_FILE="${SRCROOT}/../.env"
else
    echo "⚠️ Blinder: .env file not found at ${SRCROOT}/.env or ${SRCROOT}/../.env. Skipping injection."
    exit 0
fi

PLIST_PATH="${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}"

echo "🛡️ Blinder: Loading .env from $ENV_FILE"
while read -r line || [[ -n "$line" ]]; do
    if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
        key=$(echo "${line%%=*}" | xargs)
        value=$(echo "${line#*=}" | xargs)
        
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        if [ -n "$key" ]; then
            /usr/libexec/PlistBuddy -c "Set :$key \"$value\"" "$PLIST_PATH" 2>/dev/null || \
            /usr/libexec/PlistBuddy -c "Add :$key string \"$value\"" "$PLIST_PATH"
        fi
    fi
done < "$ENV_FILE"
echo "✅ Blinder: Info.plist updated successfully."
# --- Blinder Run Script End ---
EOF
echo "----------------------------------------------------------------"
echo ""
echo "✅ Setup script generated. Follow the instructions above to finalize."

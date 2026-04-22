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
echo "3. Name it 'Blinder Env Loader' and move it BEFORE 'Compile Sources'."
echo "4. Paste the following script into the phase:"
echo ""
echo "----------------------------------------------------------------"
cat << 'EOF'
# --- Blinder Run Script Start ---
ENV_FILE="${SRCROOT}/.env"
PLIST_PATH="${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}"

if [ -f "$ENV_FILE" ]; then
    echo "🛡️ Blinder: Loading .env from $ENV_FILE"
    while read -r line || [[ -n "$line" ]]; do
        # Ignore comments and empty lines
        if [[ ! "$line" =~ ^# ]] && [[ "$line" =~ = ]]; then
            # Extract key and value, trimming whitespace
            key=$(echo "${line%%=*}" | xargs)
            value=$(echo "${line#*=}" | xargs)
            
            # Remove quotes if present in the .env value
            value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            
            if [ -n "$key" ]; then
                # Use double quotes around "$value" for PlistBuddy to handle URLs/special chars
                /usr/libexec/PlistBuddy -c "Set :$key "$value"" "$PLIST_PATH" 2>/dev/null ||                 /usr/libexec/PlistBuddy -c "Add :$key string "$value"" "$PLIST_PATH"
            fi
        fi
    done < "$ENV_FILE"
    echo "✅ Blinder: Info.plist updated successfully."
else
    echo "⚠️ Blinder: .env file not found at $ENV_FILE. Skipping injection."
fi
# --- Blinder Run Script End ---
EOF
echo "----------------------------------------------------------------"
echo ""
echo "✅ Setup script generated. Follow the instructions above to finalize."

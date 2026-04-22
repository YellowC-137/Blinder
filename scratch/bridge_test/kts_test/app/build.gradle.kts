
// [Blinder Start] Auto-generated bridge to load .env into BuildConfig
fun loadDotenv() {
    val envFile = rootProject.file(".env")
    if (envFile.exists()) {
        envFile.forEachLine { line ->
            val match = Regex("^\\s*([\\w.-]+)\\s*=\\s*(.*)?\\s*$").find(line)
            if (match != null) {
                val key = match.groupValues[1]
                var value = match.groupValues[2]
                if (value.startsWith("\"") && value.endsWith("\"")) value = value.substring(1, value.length - 1)
                else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1)
                buildConfigField("String", key, "\"$value\"")
            }
        }
    }
}
// [Blinder End]

android {
    buildFeatures {
        buildConfig = true
    }
    defaultConfig {
        loadDotenv()
    }
}

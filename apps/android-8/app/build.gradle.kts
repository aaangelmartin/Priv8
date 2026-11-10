plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "es.priv8.ocho"
    compileSdk = 34

    defaultConfig {
        applicationId = "es.priv8.ocho"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        // Core on the laptop, reached through `adb reverse tcp:8765 tcp:8765`.
        val bridgeUrl = (project.findProperty("priv8.bridgeUrl") as String?) ?: "ws://127.0.0.1:8765"
        buildConfigField("String", "BRIDGE_URL", "\"$bridgeUrl\"")
        // Raw node-tree dump to logcat, with screen content. Off unless asked for.
        val dump = (project.findProperty("priv8.a11yDump") as String?)?.toBoolean() ?: false
        buildConfigField("boolean", "A11Y_DUMP", dump.toString())
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    testImplementation("junit:junit:4.13.2")
}

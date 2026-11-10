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
        // Core's event channel (docs/contracts/events.schema.json), through `adb reverse tcp:8700 tcp:8700`.
        val eventsUrl = (project.findProperty("priv8.eventsUrl") as String?) ?: "ws://127.0.0.1:8700/events"
        buildConfigField("String", "EVENTS_URL", "\"$eventsUrl\"")
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

    // 8's eyes: docs/ojos.html is the single source (Camino 3). It is copied
    // unchanged into the APK at build time, next to assets/ocho/app.html.
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/ojos"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

val copyOjos by tasks.registering(Copy::class) {
    from(rootProject.file("../../docs/ojos.html"))
    into(layout.buildDirectory.dir("generated/ojos/ocho"))
}
tasks.named("preBuild") { dependsOn(copyOjos) }

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    testImplementation("junit:junit:4.13.2")
    // org.json is only a stub in local unit tests; the real one parses the contract examples.
    testImplementation("org.json:json:20240303")
}

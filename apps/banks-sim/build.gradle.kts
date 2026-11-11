// Bancos simulados de Priv8: una sola base de código, un sabor por banco.
// Para añadir un banco (Brezo Banco, Nimbo Bróker), ver README.md.
plugins {
    id("com.android.application") version "8.7.3"
    id("org.jetbrains.kotlin.android") version "2.0.21"
}

android {
    namespace = "es.priv8.banks"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    flavorDimensions += "bank"
    productFlavors {
        create("alcor") {
            dimension = "bank"
            applicationId = "es.priv8.banks.alcor"
            buildConfigField("String", "SEED_ASSET", "\"seed-alcor.json\"")
        }
        create("brezo") {
            dimension = "bank"
            applicationId = "es.priv8.banks.brezo"
            buildConfigField("String", "SEED_ASSET", "\"seed-brezo.json\"")
        }
        create("nimbo") {
            dimension = "bank"
            applicationId = "es.priv8.banks.nimbo"
            buildConfigField("String", "SEED_ASSET", "\"seed-nimbo.json\"")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.biometric:biometric:1.1.0")
}

plugins {
    id("com.android.application")
}

android {
    namespace = "kr.co.cy.erp"
    compileSdk = 36

    defaultConfig {
        applicationId = "kr.co.cy.erp"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.browser:browser:1.8.0")
}

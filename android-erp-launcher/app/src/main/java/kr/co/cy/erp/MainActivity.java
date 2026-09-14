package kr.co.cy.erp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;

/** Installs a launcher icon and opens ERP with the user's browser session. */
public final class MainActivity extends Activity {
    private static final Uri ERP_URL = Uri.parse("https://cyee-9c1e4.web.app/dashboard");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(24), dp(48), dp(24), dp(48));
        layout.setBackgroundColor(Color.rgb(248, 250, 252));

        ImageView logo = new ImageView(this);
        logo.setImageResource(kr.co.cy.erp.R.drawable.ic_launcher);
        logo.setContentDescription(getString(kr.co.cy.erp.R.string.app_name));
        layout.addView(logo, new LinearLayout.LayoutParams(dp(96), dp(96)));

        TextView title = new TextView(this);
        title.setText(kr.co.cy.erp.R.string.app_name);
        title.setTextSize(24);
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setPadding(0, dp(20), 0, dp(20));
        layout.addView(title);

        Button openButton = new Button(this);
        openButton.setText(kr.co.cy.erp.R.string.open_erp);
        openButton.setOnClickListener(view -> openErp());
        layout.addView(openButton);
        setContentView(layout);

        if (savedInstanceState == null) openErp();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void openErp() {
        CustomTabsIntent intent = new CustomTabsIntent.Builder()
                .setShowTitle(true)
                .setUrlBarHidingEnabled(true)
                .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder()
                        .setToolbarColor(Color.rgb(14, 116, 144))
                        .build())
                .build();
        try {
            intent.launchUrl(this, ERP_URL);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, kr.co.cy.erp.R.string.browser_required, Toast.LENGTH_LONG).show();
        }
    }
}

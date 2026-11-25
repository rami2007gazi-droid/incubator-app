package __PKG__;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * يفتح قائمة نغمات الهاتف، وينشئ قناة إشعارات بالنغمة المختارة.
 * pick({title, name, current, previous}) -> {channelId, title, uri} أو {cancelled:true}
 * remove({channelId})
 */
@CapacitorPlugin(name = "RingtonePicker")
public class RingtonePickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, call.getString("title", "Select tone"));
        String cur = call.getString("current", "");
        if (cur != null && !cur.isEmpty()) {
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(cur));
        }
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = null;
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            uri = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        }
        if (uri == null) {
            JSObject r = new JSObject();
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }

        String id = "hatch_" + Integer.toHexString(uri.toString().hashCode());
        String title = "";
        try {
            Ringtone rt = RingtoneManager.getRingtone(getContext(), uri);
            if (rt != null) title = rt.getTitle(getContext());
        } catch (Exception ignored) { }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            String prev = call.getString("previous", "");
            if (prev != null && prev.startsWith("hatch_") && !prev.equals(id)) {
                nm.deleteNotificationChannel(prev);
            }
            NotificationChannel ch = new NotificationChannel(id, call.getString("name", "Hatch alerts"), NotificationManager.IMPORTANCE_HIGH);
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIC)
                    .build();
            ch.setSound(uri, aa);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 400, 200, 400});
            ch.enableLights(true);
            nm.createNotificationChannel(ch);
        }

        JSObject r = new JSObject();
        r.put("channelId", id);
        r.put("title", title);
        r.put("uri", uri.toString());
        call.resolve(r);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String id = call.getString("channelId", "");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && id != null && id.startsWith("hatch_")) {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            nm.deleteNotificationChannel(id);
        }
        call.resolve();
    }
}

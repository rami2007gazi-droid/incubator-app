// يبني الـ APK كاملاً: node scripts/build.js
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const run = (c, cwd) => execSync(c, { stdio: "inherit", cwd });

if (!fs.existsSync("android")) run("npx cap add android");

const mf = path.join("android", "app", "src", "main", "AndroidManifest.xml");
let m = fs.readFileSync(mf, "utf8");
if (!m.includes("POST_NOTIFICATIONS")) {
  const perms = [
    "POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM", "USE_EXACT_ALARM",
    "VIBRATE", "RECEIVE_BOOT_COMPLETED", "WAKE_LOCK"
  ].map(p => `    <uses-permission android:name="android.permission.${p}" />`).join("\n");
  m = m.replace("</manifest>", perms + "\n</manifest>");
  fs.writeFileSync(mf, m);
}

// نغمة الإشعار: ضع أي ملف باسم ringtone.wav أو ringtone.mp3 أو ringtone.ogg داخل مجلد resources
const rf = fs.readdirSync("resources").find(f => /^ringtone\.(wav|mp3|ogg)$/i.test(f));
if (rf) {
  const raw = path.join("android", "app", "src", "main", "res", "raw");
  fs.mkdirSync(raw, { recursive: true });
  fs.copyFileSync(path.join("resources", rf), path.join(raw, rf.toLowerCase()));
  const hf = path.join("www", "index.html");
  fs.writeFileSync(hf, fs.readFileSync(hf, "utf8").replace(/sound:"ringtone\.[a-z0-9]+"/, `sound:"${rf.toLowerCase()}"`));
}

// أيقونة التطبيق: تُنسخ من resources/icons فوق أيقونات أندرويد الافتراضية
const iconsDir = path.join("resources", "icons");
if (fs.existsSync(iconsDir)) {
  const resDir = path.join("android", "app", "src", "main", "res");
  const copyTree = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      e.isDirectory() ? copyTree(s, d) : fs.copyFileSync(s, d);
    }
  };
  copyTree(iconsDir, resDir);
}

// تكرار صوت إشعار التقليب حتى يُلغى الإشعار (FLAG_INSISTENT) عند وجود extra.loop
{
  const lnm = path.join("node_modules", "@capacitor", "local-notifications", "android", "src", "main", "java", "com", "capacitorjs", "plugins", "localnotifications", "LocalNotificationManager.java");
  let src = fs.readFileSync(lnm, "utf8");
  const needle = "Notification buildNotification = mBuilder.build();";
  if (!src.includes(needle)) throw new Error("تعذّر تعديل LocalNotificationManager: تغيّر الكود في هذه النسخة");
  if (!src.includes("FLAG_INSISTENT")) {
    src = src.replace(needle, needle + `
        if (localNotification.getExtra() != null && localNotification.getExtra().optBoolean("loop", false)) {
            buildNotification.flags |= Notification.FLAG_INSISTENT;
        }`);
    fs.writeFileSync(lnm, src);
  }
}

// إضافة أندرويد لاختيار نغمة من الهاتف (native/RingtonePickerPlugin.java)
{
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const main = walk(path.join("android", "app", "src", "main", "java")).find(f => f.endsWith("MainActivity.java"));
  if (!main) throw new Error("MainActivity.java غير موجود");
  const pkg = /package\s+([\w.]+);/.exec(fs.readFileSync(main, "utf8"))[1];
  const plugin = fs.readFileSync(path.join("native", "RingtonePickerPlugin.java"), "utf8").replace(/__PKG__/g, pkg);
  fs.writeFileSync(path.join(path.dirname(main), "RingtonePickerPlugin.java"), plugin);
  fs.writeFileSync(main, `package ${pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RingtonePickerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
}

run("npx cap sync android");

const win = process.platform === "win32";
if (!win) run("chmod +x gradlew", "android");
run(win ? "gradlew.bat assembleDebug" : "./gradlew assembleDebug", "android");

const out = path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
console.log("\n✅ الـ APK جاهز هنا:\n" + path.resolve(out));

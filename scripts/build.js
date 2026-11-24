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

run("npx cap sync android");

const win = process.platform === "win32";
if (!win) run("chmod +x gradlew", "android");
run(win ? "gradlew.bat assembleDebug" : "./gradlew assembleDebug", "android");

const out = path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
console.log("\n✅ الـ APK جاهز هنا:\n" + path.resolve(out));

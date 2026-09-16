import fs from "fs";
import path from "path";
import { chromium } from "playwright";

// ============================================================
// إعدادات تسجيل الدخول
// ============================================================

const LOGIN_URL = "https://wolf.live/mna";
const APP_URL = "https://app.wolf.live/";

const VIEWPORT = { width: 600, height: 600 };

const WAIT_BETWEEN_STEPS_MS = 3000;

// نفس تسلسل النقرات اللي سجّلناها بحجم نافذة 600×600
const STEPS = [
    { label: "نقرة 1", x: 40, y: 445, type: "click" },
    { label: "نقرة 2", x: 556, y: 29, type: "click" },
    { label: "نقرة 3", x: 516, y: 75, type: "click" },
    { label: "نقرة 4", x: 176, y: 341, type: "click" },
    { label: "حقل الإيميل", x: 268, y: 127, type: "type_email" },
    { label: "حقل الباسورد", x: 262, y: 197, type: "type_password" },
    { label: "زر الدخول", x: 243, y: 281, type: "click" }
];

const WOLF_EMAIL = process.env.WOLF_EMAIL || "mona24682@gmail.com";
const WOLF_PASSWORD = process.env.WOLF_PASSWORD || "As1412as";

// جلسة Chrome تُحفظ محلياً على نفس الجهاز فقط (ما تُرفع ولا تنتهي بـ24 ساعة،
// لأننا نسجل الدخول من جديد كل مرة بدلاً من الاعتماد عليها)
const WORK_DIR = path.resolve("./wolf-runtime");
const PROFILE_DIR = path.join(WORK_DIR, "profile");

// ============================================================
// Browser
// ============================================================

let browserContext = null;
let wolfPage = null;

// ============================================================
// Helpers
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function mask(value) {
    if (!value) {
        return "غير موجود";
    }

    const text = String(value);

    if (text.length <= 16) {
        return `${text.slice(0, 4)}...${text.slice(-4)}`;
    }

    return `${text.slice(0, 8)}...${text.slice(-8)}`;
}

// ============================================================
// Find Chrome
// ============================================================

function findChrome() {

    const candidates = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(
            process.env.LOCALAPPDATA || "",
            "Google",
            "Chrome",
            "Application",
            "chrome.exe"
        )
    ];

    for (const executable of candidates) {

        if (!executable) {
            continue;
        }

        if (fs.existsSync(executable)) {
            console.log(`🌐 Chrome: ${executable}`);
            return executable;
        }
    }

    console.log("⚠️ لم يتم العثور على Google Chrome، سيُستخدم Chromium الخاص بـ Playwright.");
    return null;
}

// ============================================================
// Perform Interactive Login
// ============================================================

async function performLogin() {

    if (!WOLF_EMAIL || !WOLF_PASSWORD) {
        throw new Error(
            "❌ لازم تحدد WOLF_EMAIL و WOLF_PASSWORD كمتغيرات بيئة قبل التشغيل."
        );
    }

    console.log("");
    console.log("========================================");
    console.log("🔑 تسجيل دخول تلقائي (بدون جلسة محفوظة)");
    console.log("========================================");

    fs.mkdirSync(WORK_DIR, { recursive: true });

    const executablePath = findChrome();

    const launchOptions = {
        headless: true,
        viewport: VIEWPORT,
        args: [`--window-size=${VIEWPORT.width},${VIEWPORT.height}`]
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    browserContext = await chromium.launchPersistentContext(
        PROFILE_DIR,
        launchOptions
    );

    const pages = browserContext.pages();
    wolfPage = pages.length > 0 ? pages[0] : await browserContext.newPage();

    console.log(`🌐 فتح صفحة الدخول: ${LOGIN_URL}`);

    await wolfPage.goto(LOGIN_URL, {
        waitUntil: "domcontentloaded",
        timeout: 120000
    });

    console.log("✅ تم تحميل صفحة الدخول.");

    await sleep(WAIT_BETWEEN_STEPS_MS);

    for (let i = 0; i < STEPS.length; i++) {

        const step = STEPS[i];

        console.log(
            `الخطوة ${i + 1}/${STEPS.length}: ${step.label} (x=${step.x}, y=${step.y})`
        );

        await wolfPage.mouse.click(step.x, step.y);

        if (step.type === "type_email") {
            await wolfPage.keyboard.type(WOLF_EMAIL);
        } else if (step.type === "type_password") {
            await wolfPage.keyboard.type(WOLF_PASSWORD);
        }

        if (i < STEPS.length - 1) {
            await sleep(WAIT_BETWEEN_STEPS_MS);
        }
    }

    console.log("✅ تم إرسال بيانات الدخول.");

    // إعطاء الموقع وقتاً لإتمام تسجيل الدخول وحفظ التوكنات
    console.log("⏳ انتظار اكتمال تسجيل الدخول...");

    await sleep(5000);

    console.log(`🌐 فتح ${APP_URL} لاستخراج الجلسة...`);

    await wolfPage.goto(APP_URL, {
        waitUntil: "domcontentloaded",
        timeout: 120000
    });

    console.log("⏳ انتظار تحميل جلسة WOLF...");

    await sleep(10000);

    console.log("✅ الجلسة جاهزة.");
    console.log("========================================");
}

// ============================================================
// Extract LocalStorage
// ============================================================

async function extractCredentialsFromChrome() {

    console.log("");
    console.log("========================================");
    console.log("🔐 قراءة WOLF credentials من Chrome");
    console.log("========================================");

    let data = null;

    try {

        data = await wolfPage.evaluate(() => {

            const result = {};

            for (let i = 0; i < localStorage.length; i++) {

                const key = localStorage.key(i);

                if (!key) {
                    continue;
                }

                result[key] = localStorage.getItem(key);
            }

            return result;
        });

    } catch (error) {
        throw new Error(`❌ فشل قراءة LocalStorage: ${error.message}`);
    }

    const token = data?.v3APIToken || null;
    let appCheckToken = null;

    // ------------------------------------------------------
    // App Check الحقيقي يُخزَّن تحديداً بـ:
    //   IndexedDB > firebase-app-check-database > firebase-app-check-store
    // وقد يحتاج وقت إضافي لين يتولّد (يتولّد عند أول طلب API يحتاجه).
    // نعيد المحاولة عدة مرات بدل قنص أي حقل "token" عشوائي بالداتا.
    // ------------------------------------------------------

    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !appCheckToken; attempt++) {

        if (attempt > 1) {
            console.log(
                `🔎 محاولة ${attempt}/${MAX_ATTEMPTS}: انتظار توليد appCheckToken الحقيقي...`
            );
            await sleep(RETRY_DELAY_MS);
        }

        try {

            const appCheckRecords = await wolfPage.evaluate(async () => {

                const dbName = "firebase-app-check-database";
                const storeName = "firebase-app-check-store";

                const db = await new Promise((resolve, reject) => {
                    const req = indexedDB.open(dbName);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                if (!db.objectStoreNames.contains(storeName)) {
                    db.close();
                    return [];
                }

                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);

                const records = await new Promise((resolve, reject) => {
                    const r = store.getAll();
                    r.onsuccess = () => resolve(r.result);
                    r.onerror = () => reject(r.error);
                });

                db.close();
                return records;
            });

            if (Array.isArray(appCheckRecords) && appCheckRecords.length > 0) {

                console.log(
                    `📋 firebase-app-check-store يحتوي ${appCheckRecords.length} سجل.`
                );

                // كل سجل عادة بشكل { compositeKey, token, expireTimeMillis }
                const record = appCheckRecords.find(r => r?.token) || appCheckRecords[0];

                appCheckToken = record?.token || null;
            }

        } catch (error) {
            console.log(`⚠️ تعذر فحص firebase-app-check-store: ${error.message}`);
        }
    }

    if (!appCheckToken) {
        console.log("💡 لم يتولّد appCheckToken تلقائياً — قد يحتاج الموقع طلب API فعلي ليولّده.");
    } else {
        console.log("✅ تم العثور على appCheckToken الحقيقي من firebase-app-check-store.");
    }

    if (!token) {
        console.log("❌ لم يتم العثور على v3APIToken");
        console.log("📍 تأكد أن تسجيل الدخول تم بنجاح (راجع لقطة شاشة إذا لزم).");
        throw new Error("لم يتم العثور على v3APIToken بعد تسجيل الدخول");
    }

    if (!appCheckToken) {
        console.log("❌ لم يتم العثور على appCheckToken (لا بـ localStorage ولا IndexedDB)");
        throw new Error("لم يتم العثور على appCheckToken بعد تسجيل الدخول");
    }

    console.log(`🔐 v3APIToken: ${mask(token)} (${token.length})`);
    console.log(`🛡️ appCheckToken: ${mask(appCheckToken)} (${appCheckToken.length})`);
    console.log("========================================");

    return {
        token: String(token).trim(),
        appCheckToken: String(appCheckToken).trim(),
        device: "web",
        isAppCheckEnabled: true
    };
}

// ============================================================
// Main Loader
// ============================================================

export async function loadSession() {

    console.log("");
    console.log("========================================");
    console.log("🐺 WOLF Login Loader (تسجيل دخول تلقائي)");
    console.log("========================================");

    await performLogin();

    const credentials = await extractCredentialsFromChrome();

    return credentials;
}

// ============================================================
// Optional Browser Access
// ============================================================

export function getBrowserContext() {
    return browserContext;
}

export function getWolfPage() {
    return wolfPage;
}

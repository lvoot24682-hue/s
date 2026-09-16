import fs from "fs";
import path from "path";
import { chromium } from "playwright";

// ============================================================
// إعدادات تسجيل الدخول
// ============================================================

const LOGIN_URL = "https://wolf.live/mna";
const APP_URL = "https://app.wolf.live/";

// حجم نافذة المتصفح
const VIEWPORT = {
    width: 600,
    height: 600
};

// الانتظار بين كل خطوة
const WAIT_BETWEEN_STEPS_MS = 3000;

// الانتظار بعد تحميل الصفحة وقبل أول نقرة
const WAIT_BEFORE_FIRST_CLICK_MS = 15000;

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

// ============================================================
// مجلد العمل
// ============================================================

// جلسة Chrome تُحفظ محلياً على نفس الجهاز فقط
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

    console.log(
        "⚠️ لم يتم العثور على Google Chrome، سيُستخدم Chromium الخاص بـ Playwright."
    );

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
    console.log("🔑 تسجيل دخول تلقائي");
    console.log("========================================");

    fs.mkdirSync(WORK_DIR, {
        recursive: true
    });

    const executablePath = findChrome();

    const launchOptions = {
        headless: true,

        viewport: VIEWPORT,

        args: [
            `--window-size=${VIEWPORT.width},${VIEWPORT.height}`
        ]
    };

    if (executablePath) {
        launchOptions.executablePath = executablePath;
    }

    // ========================================================
    // تشغيل Chrome
    // ========================================================

    console.log("🚀 تشغيل المتصفح...");

    browserContext = await chromium.launchPersistentContext(
        PROFILE_DIR,
        launchOptions
    );

    const pages = browserContext.pages();

    wolfPage =
        pages.length > 0
            ? pages[0]
            : await browserContext.newPage();

    // ========================================================
    // فتح صفحة الدخول
    // ========================================================

    console.log(`🌐 فتح صفحة الدخول: ${LOGIN_URL}`);

    await wolfPage.goto(LOGIN_URL, {
        waitUntil: "domcontentloaded",
        timeout: 120000
    });

    console.log("✅ تم تحميل صفحة الدخول.");

    // ========================================================
    // انتظار الصفحة قبل أول نقرة
    // ========================================================

    console.log("");
    console.log("⏳ انتظار الصفحة قبل بدء النقر...");
    console.log(
        `⏳ سيتم الانتظار ${WAIT_BEFORE_FIRST_CLICK_MS / 1000} ثانية...`
    );

    await sleep(WAIT_BEFORE_FIRST_CLICK_MS);

    console.log("✅ انتهى انتظار تحميل الصفحة.");
    console.log("🖱️ بدء تسلسل النقرات...");
    console.log("");

    // ========================================================
    // تنفيذ خطوات تسجيل الدخول
    // ========================================================

    for (let i = 0; i < STEPS.length; i++) {

        const step = STEPS[i];

        console.log(
            `الخطوة ${i + 1}/${STEPS.length}: ${step.label} ` +
            `(x=${step.x}, y=${step.y})`
        );

        // النقرة
        await wolfPage.mouse.click(
            step.x,
            step.y
        );

        // ====================================================
        // إدخال الإيميل
        // ====================================================

        if (step.type === "type_email") {

            console.log("⌨️ كتابة الإيميل...");

            await wolfPage.keyboard.type(
                WOLF_EMAIL
            );
        }

        // ====================================================
        // إدخال كلمة المرور
        // ====================================================

        else if (step.type === "type_password") {

            console.log("🔐 كتابة كلمة المرور...");

            await wolfPage.keyboard.type(
                WOLF_PASSWORD
            );
        }

        // ====================================================
        // انتظار بين الخطوات
        // ====================================================

        if (i < STEPS.length - 1) {

            console.log(
                `⏳ انتظار ${WAIT_BETWEEN_STEPS_MS / 1000} ثوانٍ...`
            );

            await sleep(
                WAIT_BETWEEN_STEPS_MS
            );
        }
    }

    // ========================================================
    // بعد إرسال بيانات الدخول
    // ========================================================

    console.log("");
    console.log("✅ تم إرسال بيانات الدخول.");

    console.log("⏳ انتظار اكتمال تسجيل الدخول...");

    await sleep(5000);

    // ========================================================
    // فتح APP_URL
    // ========================================================

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
// Extract LocalStorage + IndexedDB
// ============================================================

async function extractCredentialsFromChrome() {

    console.log("");
    console.log("========================================");
    console.log("🔐 قراءة WOLF credentials من Chrome");
    console.log("========================================");

    let data = null;

    // ========================================================
    // قراءة LocalStorage
    // ========================================================

    try {

        data = await wolfPage.evaluate(() => {

            const result = {};

            for (
                let i = 0;
                i < localStorage.length;
                i++
            ) {

                const key = localStorage.key(i);

                if (!key) {
                    continue;
                }

                result[key] =
                    localStorage.getItem(key);
            }

            return result;
        });

    } catch (error) {

        throw new Error(
            `❌ فشل قراءة LocalStorage: ${error.message}`
        );
    }

    // ========================================================
    // استخراج v3APIToken
    // ========================================================

    const token =
        data?.v3APIToken || null;

    let appCheckToken = null;

    // ========================================================
    // قراءة Firebase App Check
    // ========================================================

    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY_MS = 5000;

    for (
        let attempt = 1;
        attempt <= MAX_ATTEMPTS && !appCheckToken;
        attempt++
    ) {

        if (attempt > 1) {

            console.log(
                `🔎 محاولة ${attempt}/${MAX_ATTEMPTS}: ` +
                "انتظار توليد appCheckToken الحقيقي..."
            );

            await sleep(
                RETRY_DELAY_MS
            );
        }

        try {

            const appCheckRecords =
                await wolfPage.evaluate(
                    async () => {

                        const dbName =
                            "firebase-app-check-database";

                        const storeName =
                            "firebase-app-check-store";

                        // ------------------------------------
                        // فتح IndexedDB
                        // ------------------------------------

                        const db =
                            await new Promise(
                                (resolve, reject) => {

                                    const req =
                                        indexedDB.open(
                                            dbName
                                        );

                                    req.onsuccess = () =>
                                        resolve(
                                            req.result
                                        );

                                    req.onerror = () =>
                                        reject(
                                            req.error
                                        );
                                }
                            );

                        // ------------------------------------
                        // التأكد من وجود Store
                        // ------------------------------------

                        if (
                            !db.objectStoreNames.contains(
                                storeName
                            )
                        ) {

                            db.close();

                            return [];
                        }

                        // ------------------------------------
                        // قراءة السجلات
                        // ------------------------------------

                        const tx =
                            db.transaction(
                                storeName,
                                "readonly"
                            );

                        const store =
                            tx.objectStore(
                                storeName
                            );

                        const records =
                            await new Promise(
                                (resolve, reject) => {

                                    const r =
                                        store.getAll();

                                    r.onsuccess = () =>
                                        resolve(
                                            r.result
                                        );

                                    r.onerror = () =>
                                        reject(
                                            r.error
                                        );
                                }
                            );

                        db.close();

                        return records;
                    }
                );

            // =================================================
            // معالجة النتائج
            // =================================================

            if (
                Array.isArray(appCheckRecords) &&
                appCheckRecords.length > 0
            ) {

                console.log(
                    `📋 firebase-app-check-store يحتوي ` +
                    `${appCheckRecords.length} سجل.`
                );

                // عادة يكون السجل:
                //
                // {
                //   compositeKey,
                //   token,
                //   expireTimeMillis
                // }

                const record =
                    appCheckRecords.find(
                        r => r?.token
                    ) ||
                    appCheckRecords[0];

                appCheckToken =
                    record?.token || null;
            }

        } catch (error) {

            console.log(
                `⚠️ تعذر فحص firebase-app-check-store: ` +
                `${error.message}`
            );
        }
    }

    // ========================================================
    // التحقق من App Check
    // ========================================================

    if (!appCheckToken) {

        console.log(
            "💡 لم يتولّد appCheckToken تلقائياً — " +
            "قد يحتاج الموقع طلب API فعلي ليولّده."
        );

    } else {

        console.log(
            "✅ تم العثور على appCheckToken الحقيقي " +
            "من firebase-app-check-store."
        );
    }

    // ========================================================
    // التحقق من v3APIToken
    // ========================================================

    if (!token) {

        console.log(
            "❌ لم يتم العثور على v3APIToken"
        );

        console.log(
            "📍 تأكد أن تسجيل الدخول تم بنجاح."
        );

        throw new Error(
            "لم يتم العثور على v3APIToken بعد تسجيل الدخول"
        );
    }

    // ========================================================
    // التحقق من App Check Token
    // ========================================================

    if (!appCheckToken) {

        console.log(
            "❌ لم يتم العثور على appCheckToken " +
            "(لا بـ localStorage ولا IndexedDB)"
        );

        throw new Error(
            "لم يتم العثور على appCheckToken بعد تسجيل الدخول"
        );
    }

    // ========================================================
    // عرض البيانات بشكل مخفي
    // ========================================================

    console.log(
        `🔐 v3APIToken: ${mask(token)} (${token.length})`
    );

    console.log(
        `🛡️ appCheckToken: ` +
        `${mask(appCheckToken)} (${appCheckToken.length})`
    );

    console.log("========================================");

    // ========================================================
    // إرجاع credentials
    // ========================================================

    return {

        token: String(token).trim(),

        appCheckToken:
            String(appCheckToken).trim(),

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
    console.log("🐺 WOLF Login Loader");
    console.log("========================================");

    // تسجيل الدخول
    await performLogin();

    // استخراج التوكنات
    const credentials =
        await extractCredentialsFromChrome();

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

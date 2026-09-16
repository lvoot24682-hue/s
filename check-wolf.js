import puppeteer from "puppeteer";
import fs from "fs";

const WOLF_URL = "https://wolf.live/mna";

const EMAIL = process.env.WOLF_EMAIL;
const PASSWORD = process.env.WOLF_PASSWORD;
const CHROME_PATH = process.env.CHROME_PATH;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let browser;
let page;

function logLine() {
    console.log("========================================");
}

async function saveScreenshot(name) {
    try {
        await page.screenshot({
            path: `/tmp/${name}.png`,
            fullPage: false
        });

        console.log(`📸 تم حفظ الصورة: /tmp/${name}.png`);
    } catch (err) {
        console.log("⚠️ فشل حفظ الصورة:", err.message);
    }
}

async function printBrowserInfo() {
    logLine();
    console.log("🔎 معلومات Chrome");
    logLine();

    console.log("CHROME_PATH:");
    console.log(CHROME_PATH || "غير محدد");

    console.log("");

    try {
        console.log("Browser version:");
        console.log(await browser.version());
    } catch (err) {
        console.log("❌ تعذر قراءة إصدار Chrome:", err.message);
    }

    console.log("");

    const info = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        webdriver: navigator.webdriver,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio,
        url: location.href
    }));

    console.log("User Agent:");
    console.log(info.userAgent);

    console.log("");
    console.log("navigator.webdriver:", info.webdriver);
    console.log("innerWidth:", info.innerWidth);
    console.log("innerHeight:", info.innerHeight);
    console.log("outerWidth:", info.outerWidth);
    console.log("outerHeight:", info.outerHeight);
    console.log("DPR:", info.devicePixelRatio);
    console.log("URL:", info.url);

    logLine();
}

async function printPageText() {
    try {
        const text = await page.evaluate(() => {
            return document.body?.innerText || "";
        });

        console.log("");
        console.log("📄 النص الظاهر في الصفحة:");
        console.log("----------------------------------------");
        console.log(text.slice(0, 5000));
        console.log("----------------------------------------");
    } catch (err) {
        console.log("⚠️ تعذر قراءة نص الصفحة:", err.message);
    }
}

async function inspectInputs() {
    try {
        const inputs = await page.evaluate(() => {
            return [...document.querySelectorAll("input")].map((input, index) => ({
                index,
                type: input.type,
                name: input.name,
                placeholder: input.placeholder,
                autocomplete: input.autocomplete,
                ariaLabel: input.getAttribute("aria-label"),
                visible:
                    !!(
                        input.offsetWidth ||
                        input.offsetHeight ||
                        input.getClientRects().length
                    )
            }));
        });

        console.log("");
        console.log("🔎 حقول الإدخال الموجودة:");
        console.log(JSON.stringify(inputs, null, 2));
    } catch (err) {
        console.log("⚠️ فشل فحص الحقول:", err.message);
    }
}

async function loginWithCoordinates() {
    if (!EMAIL || !PASSWORD) {
        throw new Error(
            "❌ WOLF_EMAIL أو WOLF_PASSWORD غير موجودين في GitHub Secrets"
        );
    }

    logLine();
    console.log("🔐 بدء خطوات تسجيل الدخول");
    logLine();

    await sleep(5000);

    await saveScreenshot("wolf-login-before");

    await printPageText();
    await inspectInputs();

    /*
     * الإحداثيات التي كانت تعمل عندك محليًا.
     * نستخدمها هنا كما هي، لكن نسجل صورة قبل وبعد
     * حتى نعرف هل واجهة GitHub مختلفة.
     */

    console.log("");
    console.log("🖱️ نقرة 1...");
    await page.mouse.click(40, 445);
    await sleep(1000);

    console.log("🖱️ نقرة 2...");
    await page.mouse.click(556, 29);
    await sleep(1000);

    console.log("🖱️ نقرة 3...");
    await page.mouse.click(516, 75);
    await sleep(1500);

    console.log("🖱️ نقرة 4...");
    await page.mouse.click(176, 341);
    await sleep(1500);

    await saveScreenshot("wolf-login-form");

    console.log("");
    console.log("📧 كتابة الإيميل...");

    await page.mouse.click(268, 127);

    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");

    await page.keyboard.type(EMAIL, {
        delay: 50
    });

    await sleep(700);

    console.log("🔑 كتابة الباسورد...");

    await page.mouse.click(262, 197);

    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");

    await page.keyboard.type(PASSWORD, {
        delay: 50
    });

    await sleep(700);

    await saveScreenshot("wolf-login-filled");

    console.log("");
    console.log("🖱️ زر الدخول...");

    await page.mouse.click(243, 281);

    console.log("⏳ انتظار نتيجة تسجيل الدخول...");

    await sleep(10000);

    await saveScreenshot("wolf-login-after");

    console.log("");
    console.log("🌐 URL بعد محاولة الدخول:");
    console.log(await page.url());

    await printPageText();
}

async function readCredentials() {
    logLine();
    console.log("🔐 قراءة WOLF credentials");
    logLine();

    for (let i = 1; i <= 30; i++) {
        console.log(`🔎 محاولة ${i}/30`);

        const result = await page.evaluate(() => {
            const local = {};

            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);

                    if (
                        key &&
                        (
                            key.toLowerCase().includes("token") ||
                            key.toLowerCase().includes("device") ||
                            key.toLowerCase().includes("appcheck")
                        )
                    ) {
                        local[key] = localStorage.getItem(key);
                    }
                }
            } catch {}

            const session = {};

            try {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);

                    if (
                        key &&
                        (
                            key.toLowerCase().includes("token") ||
                            key.toLowerCase().includes("device") ||
                            key.toLowerCase().includes("appcheck")
                        )
                    ) {
                        session[key] = sessionStorage.getItem(key);
                    }
                }
            } catch {}

            return {
                local,
                session
            };
        });

        const all = {
            ...result.local,
            ...result.session
        };

        const findValue = (...names) => {
            for (const wanted of names) {
                const key = Object.keys(all).find(
                    (k) => k.toLowerCase() === wanted.toLowerCase()
                );

                if (key && all[key]) {
                    return all[key];
                }
            }

            return null;
        };

        const v3APIToken = findValue(
            "v3APIToken",
            "v3ApiToken",
            "v3_api_token"
        );

        const appCheckToken = findValue(
            "appCheckToken",
            "app_check_token"
        );

        const deviceToken = findValue(
            "deviceToken",
            "device_token"
        );

        console.log(
            "   v3APIToken:",
            v3APIToken ? "موجود" : "غير موجود"
        );

        console.log(
            "   appCheckToken:",
            appCheckToken ? "موجود" : "غير موجود"
        );

        console.log(
            "   deviceToken:",
            deviceToken ? "موجود" : "غير موجود"
        );

        if (v3APIToken) {
            logLine();
            console.log("✅ تم العثور على v3APIToken");
            console.log("⚠️ لن يتم طباعة قيمة التوكن حفاظًا على الأمان");
            logLine();

            return {
                v3APIToken,
                appCheckToken,
                deviceToken
            };
        }

        await sleep(2000);
    }

    return null;
}

async function main() {
    try {
        if (!EMAIL || !PASSWORD) {
            throw new Error(
                "❌ يجب إضافة WOLF_EMAIL و WOLF_PASSWORD في GitHub Secrets"
            );
        }

        if (!CHROME_PATH) {
            throw new Error(
                "❌ CHROME_PATH غير موجود"
            );
        }

        console.log("");
        console.log("🐺 WOLF Browser Login Diagnostic");
        console.log("");

        console.log("Chrome executable:");
        console.log(CHROME_PATH);

        if (!fs.existsSync(CHROME_PATH)) {
            throw new Error(
                `❌ ملف Chrome غير موجود في: ${CHROME_PATH}`
            );
        }

        console.log("");
        console.log("🚀 تشغيل Google Chrome...");

        browser = await puppeteer.launch({
            executablePath: CHROME_PATH,

            headless: false,

            defaultViewport: {
                width: 600,
                height: 600,
                deviceScaleFactor: 1
            },

            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",

                "--window-size=600,600",

                "--lang=ar-SA",
                "--accept-lang=ar-SA,ar,en-US,en",

                "--no-first-run",
                "--no-default-browser-check",

                "--disable-popup-blocking",
                "--disable-notifications"
            ]
        });

        page = await browser.newPage();

        /*
         * أخطاء JavaScript داخل WOLF
         */
        page.on("pageerror", (error) => {
            console.log("");
            console.log("⚠️ PAGE ERROR");
            console.log(error?.stack || error?.message || error);
        });

        /*
         * أخطاء الشبكة فقط.
         * لا نطبع Headers أو Cookies أو Body.
         */
        page.on("requestfailed", (request) => {
            const failure = request.failure();

            if (failure) {
                console.log(
                    "🌐 Request failed:",
                    request.url(),
                    "|",
                    failure.errorText
                );
            }
        });

        page.on("console", (message) => {
            const type = message.type();

            if (
                type === "error" ||
                type === "warning"
            ) {
                console.log(
                    `[PAGE ${type}]`,
                    message.text()
                );
            }
        });

        await printBrowserInfo();

        console.log("");
        console.log("🌐 فتح WOLF...");
        console.log(WOLF_URL);

        await page.goto(WOLF_URL, {
            waitUntil: "domcontentloaded",
            timeout: 120000
        });

        console.log("✅ WOLF opened");

        await sleep(8000);

        console.log("");
        console.log("📐 معلومات الصفحة بعد التحميل:");

        const pageInfo = await page.evaluate(() => ({
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            dpr: window.devicePixelRatio,
            url: location.href,
            title: document.title,
            userAgent: navigator.userAgent
        }));

        console.log("innerWidth :", pageInfo.innerWidth);
        console.log("innerHeight:", pageInfo.innerHeight);
        console.log("outerWidth :", pageInfo.outerWidth);
        console.log("outerHeight:", pageInfo.outerHeight);
        console.log("DPR        :", pageInfo.dpr);
        console.log("URL        :", pageInfo.url);
        console.log("Title      :", pageInfo.title);
        console.log("Browser    :", pageInfo.userAgent);

        await saveScreenshot("wolf-page-loaded");

        /*
         * محاولة الدخول
         */
        await loginWithCoordinates();

        /*
         * إعطاء WOLF وقتًا لإكمال الجلسة
         */
        console.log("");
        console.log("⏳ انتظار اكتمال الجلسة...");
        await sleep(15000);

        await saveScreenshot("wolf-session-final");

        /*
         * قراءة credentials
         */
        const credentials = await readCredentials();

        if (!credentials) {
            logLine();
            console.log("❌ لم يتم تسجيل الدخول بشكل مكتمل");
            console.log("");
            console.log(
                "راجع الصور المرفوعة من GitHub Actions:"
            );
            console.log(
                "wolf-page-loaded"
            );
            console.log(
                "wolf-login-before"
            );
            console.log(
                "wolf-login-form"
            );
            console.log(
                "wolf-login-filled"
            );
            console.log(
                "wolf-login-after"
            );
            console.log(
                "wolf-session-final"
            );
            logLine();

            process.exitCode = 1;
            return;
        }

        logLine();
        console.log("✅ تسجيل الدخول يبدو ناجحًا");
        console.log("🐺 يمكن الآن الانتقال إلى wolf.js");
        logLine();

        /*
         * نبقي المتصفح مفتوحًا قليلًا للتشخيص.
         */
        await sleep(5000);

    } catch (error) {
        console.log("");
        console.log("❌ حصل خطأ:");
        console.log(error?.stack || error?.message || error);

        if (page) {
            await saveScreenshot("wolf-error").catch(() => {});
        }

        process.exitCode = 1;

    } finally {
        /*
         * في مرحلة التشخيص نغلق Chrome.
         */
        if (browser) {
            try {
                await browser.close();
            } catch {}
        }
    }
}

process.on("SIGINT", async () => {
    console.log("");
    console.log("🛑 إيقاف البرنامج...");

    if (browser) {
        try {
            await browser.close();
        } catch {}
    }

    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("");
    console.log("🛑 إيقاف البرنامج...");

    if (browser) {
        try {
            await browser.close();
        } catch {}
    }

    process.exit(0);
});

main();

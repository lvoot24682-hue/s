import puppeteer from "puppeteer";
import fs from "fs";

// ============================================================
// WOLF Browser Diagnostic
// ============================================================

const WOLF_URL = "https://wolf.live/mna";

const EMAIL = process.env.WOLF_EMAIL;
const PASSWORD = process.env.WOLF_PASSWORD;
const CHROME_PATH = process.env.CHROME_PATH;

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

let browser = null;
let page = null;

// ============================================================
// Helpers
// ============================================================

function separator() {
    console.log("========================================");
}

async function screenshot(name) {
    if (!page) return;

    try {
        await page.screenshot({
            path: `/tmp/${name}.png`,
            fullPage: false
        });

        console.log(`📸 تم حفظ الصورة: /tmp/${name}.png`);
    } catch (error) {
        console.log(
            `⚠️ فشل حفظ ${name}:`,
            error?.message || error
        );
    }
}

// ============================================================
// Browser information
// ============================================================

async function browserInfo() {
    separator();

    console.log("🔎 معلومات Chrome");

    separator();

    console.log("Chrome executable:");
    console.log(CHROME_PATH || "غير موجود");

    console.log("");

    try {
        console.log("Browser version:");
        console.log(await browser.version());
    } catch (error) {
        console.log(
            "⚠️ تعذر قراءة إصدار Chrome:",
            error?.message || error
        );
    }

    console.log("");

    try {
        const info = await page.evaluate(() => ({
            userAgent: navigator.userAgent,
            webdriver: navigator.webdriver,

            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,

            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,

            devicePixelRatio: window.devicePixelRatio,

            url: location.href,
            title: document.title
        }));

        console.log("User Agent:");
        console.log(info.userAgent);

        console.log("");

        console.log("navigator.webdriver:");
        console.log(info.webdriver);

        console.log("");

        console.log("innerWidth :", info.innerWidth);
        console.log("innerHeight:", info.innerHeight);
        console.log("outerWidth :", info.outerWidth);
        console.log("outerHeight:", info.outerHeight);
        console.log("DPR        :", info.devicePixelRatio);

        console.log("");

        console.log("URL:");
        console.log(info.url);

        console.log("");

        console.log("Title:");
        console.log(info.title);

    } catch (error) {
        console.log(
            "⚠️ فشل قراءة معلومات الصفحة:",
            error?.message || error
        );
    }

    separator();
}

// ============================================================
// Page text
// ============================================================

async function getPageText() {
    try {
        return await page.evaluate(() => {
            return document.body?.innerText || "";
        });
    } catch {
        return "";
    }
}

// ============================================================
// Inspect page
// ============================================================

async function inspectPage() {
    separator();

    console.log("🔎 فحص صفحة WOLF");

    separator();

    const result = await page.evaluate(() => {

        const text =
            document.body?.innerText || "";

        const inputs =
            [...document.querySelectorAll("input")]
                .map((input, index) => ({
                    index,
                    type: input.type,
                    name: input.name,
                    placeholder: input.placeholder,
                    autocomplete: input.autocomplete,
                    ariaLabel:
                        input.getAttribute("aria-label"),

                    visible:
                        !!(
                            input.offsetWidth ||
                            input.offsetHeight ||
                            input.getClientRects().length
                        )
                }));

        return {
            url: location.href,
            title: document.title,

            disconnected:
                text.includes("تم فقدان الاتصال") ||
                text.includes("لم نتمكن من إعادة الاتصال تلقائيًا"),

            reconnect:
                text.includes("إعادة المحاولة"),

            hasEmail:
                !!document.querySelector(
                    'input[type="email"]'
                ),

            hasPassword:
                !!document.querySelector(
                    'input[type="password"]'
                ),

            inputs,

            text: text.slice(0, 5000)
        };
    });

    console.log("URL:");
    console.log(result.url);

    console.log("");

    console.log("Title:");
    console.log(result.title);

    console.log("");

    console.log("Disconnected:");
    console.log(result.disconnected);

    console.log("");

    console.log("Reconnect button:");
    console.log(result.reconnect);

    console.log("");

    console.log("Email input:");
    console.log(result.hasEmail);

    console.log("");

    console.log("Password input:");
    console.log(result.hasPassword);

    console.log("");

    console.log("Inputs:");
    console.log(
        JSON.stringify(
            result.inputs,
            null,
            2
        )
    );

    console.log("");

    console.log("Page text:");
    console.log("----------------------------------------");
    console.log(result.text);
    console.log("----------------------------------------");

    separator();

    return result;
}

// ============================================================
// Check connection
// ============================================================

async function checkWolfConnection() {

    const result = await page.evaluate(() => {

        const text =
            document.body?.innerText || "";

        return {

            disconnected:
                text.includes("تم فقدان الاتصال") ||
                text.includes(
                    "لم نتمكن من إعادة الاتصال تلقائيًا"
                ),

            reconnect:
                text.includes("إعادة المحاولة"),

            url: location.href
        };
    });

    console.log("");
    console.log("🔌 حالة اتصال WOLF");
    console.log("----------------------------------------");

    console.log(
        "Disconnected:",
        result.disconnected
    );

    console.log(
        "Reconnect:",
        result.reconnect
    );

    console.log(
        "URL:",
        result.url
    );

    console.log("----------------------------------------");

    return result;
}

// ============================================================
// Try reconnect button
// ============================================================

async function tryReconnect() {

    console.log("");
    console.log("🔄 محاولة إعادة الاتصال من زر WOLF");

    try {

        const button = await page.evaluate(() => {

            const elements =
                [...document.querySelectorAll("button")];

            const target =
                elements.find((element) => {

                    const text =
                        element.innerText?.trim() || "";

                    return (
                        text.includes("إعادة المحاولة") ||
                        text.includes("Retry")
                    );
                });

            if (!target) {
                return false;
            }

            target.click();

            return true;
        });

        if (button) {

            console.log(
                "✅ تم الضغط على إعادة المحاولة"
            );

            await sleep(8000);

        } else {

            console.log(
                "⚠️ زر إعادة المحاولة غير موجود"
            );
        }

    } catch (error) {

        console.log(
            "⚠️ فشل إعادة الاتصال:",
            error?.message || error
        );
    }
}

// ============================================================
// Login coordinates
// ============================================================

async function loginWithCoordinates() {

    if (!EMAIL) {
        throw new Error(
            "❌ WOLF_EMAIL غير موجود"
        );
    }

    if (!PASSWORD) {
        throw new Error(
            "❌ WOLF_PASSWORD غير موجود"
        );
    }

    separator();

    console.log("🔐 بدء خطوات تسجيل الدخول");

    separator();

    /*
     * مهم:
     * لا ننفذ أي click إذا كانت الصفحة مفصولة.
     */

    let state =
        await checkWolfConnection();

    if (state.disconnected) {

        await screenshot(
            "wolf-disconnected-before-login"
        );

        console.log("");
        console.log(
            "⚠️ الصفحة غير متصلة."
        );

        console.log(
            "⛔ لن يتم تنفيذ إحداثيات تسجيل الدخول."
        );

        /*
         * محاولة واحدة فقط من زر إعادة الاتصال.
         */
        await tryReconnect();

        await sleep(5000);

        state =
            await checkWolfConnection();

        if (state.disconnected) {

            await screenshot(
                "wolf-still-disconnected"
            );

            throw new Error(
                "❌ WOLF ما زال غير متصل بعد محاولة إعادة الاتصال."
            );
        }
    }

    await screenshot(
        "wolf-login-before"
    );

    const pageState =
        await inspectPage();

    /*
     * إذا لا توجد شاشة تسجيل دخول
     * ولا حقول إدخال، لا ننفذ الإحداثيات.
     */

    if (
        !pageState.hasEmail &&
        !pageState.hasPassword
    ) {

        console.log("");
        console.log(
            "⚠️ لم يتم العثور على حقول تسجيل الدخول."
        );

        console.log(
            "⛔ لن يتم تنفيذ الإحداثيات."
        );

        throw new Error(
            "❌ شاشة تسجيل الدخول غير موجودة حاليًا."
        );
    }

    // ========================================================
    // Coordinates
    // ========================================================

    console.log("");
    console.log("🖱️ نقرة 1...");

    await page.mouse.click(
        40,
        445
    );

    await sleep(1000);

    console.log("🖱️ نقرة 2...");

    await page.mouse.click(
        556,
        29
    );

    await sleep(1000);

    console.log("🖱️ نقرة 3...");

    await page.mouse.click(
        516,
        75
    );

    await sleep(1500);

    console.log("🖱️ نقرة 4...");

    await page.mouse.click(
        176,
        341
    );

    await sleep(1500);

    await screenshot(
        "wolf-login-form"
    );

    // ========================================================
    // Email
    // ========================================================

    console.log("");
    console.log("📧 كتابة الإيميل...");

    await page.mouse.click(
        268,
        127
    );

    await page.keyboard.down(
        "Control"
    );

    await page.keyboard.press(
        "A"
    );

    await page.keyboard.up(
        "Control"
    );

    await page.keyboard.type(
        EMAIL,
        {
            delay: 50
        }
    );

    await sleep(700);

    // ========================================================
    // Password
    // ========================================================

    console.log("");
    console.log("🔑 كتابة الباسورد...");

    await page.mouse.click(
        262,
        197
    );

    await page.keyboard.down(
        "Control"
    );

    await page.keyboard.press(
        "A"
    );

    await page.keyboard.up(
        "Control"
    );

    await page.keyboard.type(
        PASSWORD,
        {
            delay: 50
        }
    );

    await sleep(700);

    await screenshot(
        "wolf-login-filled"
    );

    // ========================================================
    // Login
    // ========================================================

    console.log("");
    console.log("🖱️ زر الدخول...");

    await page.mouse.click(
        243,
        281
    );

    console.log("");
    console.log(
        "⏳ انتظار نتيجة تسجيل الدخول..."
    );

    await sleep(10000);

    await screenshot(
        "wolf-login-after"
    );

    console.log("");
    console.log("🌐 URL بعد محاولة الدخول:");
    console.log(await page.url());

    await inspectPage();
}

// ============================================================
// Read credentials
// ============================================================

async function readCredentials() {

    separator();

    console.log("🔐 قراءة WOLF credentials");

    separator();

    for (
        let attempt = 1;
        attempt <= 30;
        attempt++
    ) {

        console.log(
            `🔎 محاولة ${attempt}/30`
        );

        const data =
            await page.evaluate(() => {

                const local = {};
                const session = {};

                try {

                    for (
                        let i = 0;
                        i < localStorage.length;
                        i++
                    ) {

                        const key =
                            localStorage.key(i);

                        if (!key) continue;

                        const lower =
                            key.toLowerCase();

                        if (
                            lower.includes("token") ||
                            lower.includes("device") ||
                            lower.includes("appcheck")
                        ) {

                            local[key] =
                                localStorage.getItem(
                                    key
                                );
                        }
                    }

                } catch {}

                try {

                    for (
                        let i = 0;
                        i < sessionStorage.length;
                        i++
                    ) {

                        const key =
                            sessionStorage.key(i);

                        if (!key) continue;

                        const lower =
                            key.toLowerCase();

                        if (
                            lower.includes("token") ||
                            lower.includes("device") ||
                            lower.includes("appcheck")
                        ) {

                            session[key] =
                                sessionStorage.getItem(
                                    key
                                );
                        }
                    }

                } catch {}

                return {
                    local,
                    session
                };
            });

        const values = {
            ...data.local,
            ...data.session
        };

        const findValue = (
            ...wantedNames
        ) => {

            for (
                const wanted
                of wantedNames
            ) {

                const key =
                    Object.keys(values)
                        .find(
                            (key) =>
                                key.toLowerCase() ===
                                wanted.toLowerCase()
                        );

                if (
                    key &&
                    values[key]
                ) {
                    return values[key];
                }
            }

            return null;
        };

        const v3APIToken =
            findValue(
                "v3APIToken",
                "v3ApiToken",
                "v3_api_token"
            );

        const appCheckToken =
            findValue(
                "appCheckToken",
                "app_check_token"
            );

        const deviceToken =
            findValue(
                "deviceToken",
                "device_token"
            );

        console.log(
            "   v3APIToken:",
            v3APIToken
                ? "موجود"
                : "غير موجود"
        );

        console.log(
            "   appCheckToken:",
            appCheckToken
                ? "موجود"
                : "غير موجود"
        );

        console.log(
            "   deviceToken:",
            deviceToken
                ? "موجود"
                : "غير موجود"
        );

        if (v3APIToken) {

            separator();

            console.log(
                "✅ تم العثور على v3APIToken"
            );

            console.log(
                "⚠️ لن يتم طباعة قيمة التوكن."
            );

            separator();

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

// ============================================================
// Main
// ============================================================

async function main() {

    try {

        console.log("");
        console.log(
            "🐺 WOLF Browser Login Diagnostic"
        );

        console.log("");

        if (!EMAIL) {

            throw new Error(
                "❌ WOLF_EMAIL غير موجود"
            );
        }

        if (!PASSWORD) {

            throw new Error(
                "❌ WOLF_PASSWORD غير موجود"
            );
        }

        if (!CHROME_PATH) {

            throw new Error(
                "❌ CHROME_PATH غير موجود"
            );
        }

        if (
            !fs.existsSync(
                CHROME_PATH
            )
        ) {

            throw new Error(
                `❌ Chrome غير موجود:\n${CHROME_PATH}`
            );
        }

        // ======================================================
        // Launch Chrome
        // ======================================================

        console.log("");
        console.log(
            "🚀 تشغيل Google Chrome..."
        );

        browser =
            await puppeteer.launch({

                executablePath:
                    CHROME_PATH,

                headless:
                    false,

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

        page =
            await browser.newPage();

        // ======================================================
        // Page events
        // ======================================================

        page.on(
            "pageerror",
            (error) => {

                console.log("");
                console.log(
                    "⚠️ PAGE ERROR"
                );

                console.log(
                    error?.stack ||
                    error?.message ||
                    error
                );
            }
        );

        page.on(
            "requestfailed",
            (request) => {

                const failure =
                    request.failure();

                if (!failure) return;

                /*
                 * لا نطبع Headers أو Cookies
                 * أو request body.
                 */

                console.log(
                    "🌐 Request failed:",
                    request.url(),
                    "|",
                    failure.errorText
                );
            }
        );

        page.on(
            "console",
            (message) => {

                const type =
                    message.type();

                if (
                    type === "error" ||
                    type === "warning"
                ) {

                    console.log(
                        `[PAGE ${type}]`,
                        message.text()
                    );
                }
            }
        );

        // ======================================================
        // Browser info
        // ======================================================

        await browserInfo();

        // ======================================================
        // Open WOLF
        // ======================================================

        console.log("");
        console.log(
            "🌐 فتح WOLF..."
        );

        console.log(
            WOLF_URL
        );

        await page.goto(
            WOLF_URL,
            {
                waitUntil:
                    "domcontentloaded",

                timeout:
                    120000
            }
        );

        console.log(
            "✅ WOLF opened"
        );

        // ======================================================
        // Wait for WOLF
        // ======================================================

        await sleep(8000);

        // ======================================================
        // Page dimensions
        // ======================================================

        console.log("");
        console.log(
            "📐 معلومات الصفحة"
        );

        const dimensions =
            await page.evaluate(
                () => ({
                    innerWidth:
                        window.innerWidth,

                    innerHeight:
                        window.innerHeight,

                    outerWidth:
                        window.outerWidth,

                    outerHeight:
                        window.outerHeight,

                    dpr:
                        window.devicePixelRatio,

                    url:
                        location.href
                })
            );

        console.log(
            "innerWidth :",
            dimensions.innerWidth
        );

        console.log(
            "innerHeight:",
            dimensions.innerHeight
        );

        console.log(
            "outerWidth :",
            dimensions.outerWidth
        );

        console.log(
            "outerHeight:",
            dimensions.outerHeight
        );

        console.log(
            "DPR        :",
            dimensions.dpr
        );

        console.log(
            "URL        :",
            dimensions.url
        );

        // ======================================================
        // Screenshot
        // ======================================================

        await screenshot(
            "wolf-page-loaded"
        );

        // ======================================================
        // Inspect
        // ======================================================

        const initialState =
            await inspectPage();

        // ======================================================
        // Login
        // ======================================================

        await loginWithCoordinates();

        // ======================================================
        // Wait
        // ======================================================

        console.log("");
        console.log(
            "⏳ انتظار اكتمال الجلسة..."
        );

        await sleep(15000);

        await screenshot(
            "wolf-session-final"
        );

        // ======================================================
        // Credentials
        // ======================================================

        const credentials =
            await readCredentials();

        if (!credentials) {

            separator();

            console.log(
                "❌ لم يتم الحصول على جلسة WOLF مكتملة."
            );

            console.log("");

            console.log(
                "الصور الموجودة:"
            );

            console.log(
                "/tmp/wolf-page-loaded.png"
            );

            console.log(
                "/tmp/wolf-login-before.png"
            );

            console.log(
                "/tmp/wolf-login-form.png"
            );

            console.log(
                "/tmp/wolf-login-filled.png"
            );

            console.log(
                "/tmp/wolf-login-after.png"
            );

            console.log(
                "/tmp/wolf-session-final.png"
            );

            separator();

            process.exitCode = 1;

            return;
        }

        // ======================================================
        // Success
        // ======================================================

        separator();

        console.log(
            "✅ جلسة WOLF موجودة"
        );

        console.log(
            "🐺 المتصفح نجح في الوصول إلى credentials."
        );

        console.log(
            "⛔ wolf.js غير مشغل في هذه النسخة."
        );

        console.log(
            "الخطوة التالية تكون بعد نجاح هذه المرحلة."
        );

        separator();

    } catch (error) {

        console.log("");
        console.log(
            "❌ حصل خطأ:"
        );

        console.log(
            error?.stack ||
            error?.message ||
            error
        );

        if (page) {

            await screenshot(
                "wolf-error"
            );
        }

        process.exitCode = 1;

    } finally {

        if (browser) {

            try {

                await browser.close();

            } catch {}
        }
    }
}

// ============================================================
// Shutdown
// ============================================================

process.on(
    "SIGINT",
    async () => {

        console.log(
            "🛑 إيقاف البرنامج..."
        );

        if (browser) {

            try {
                await browser.close();
            } catch {}
        }

        process.exit(0);
    }
);

process.on(
    "SIGTERM",
    async () => {

        console.log(
            "🛑 إيقاف البرنامج..."
        );

        if (browser) {

            try {
                await browser.close();
            } catch {}
        }

        process.exit(0);
    }
);

// ============================================================
// Start
// ============================================================

main();

import puppeteer from "puppeteer";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import http from "http";

// ============================================================
// WOLF LOGIN CONFIG
// ============================================================

const WOLF_URL = "https://wolf.live/mna";

const CDP_PORT = 9222;

const WIDTH = 600;
const HEIGHT = 600;

const WOLF_EMAIL = "mona24682@gmail.com";
const WOLF_PASSWORD = "As1412as";

// ============================================================
// Login Coordinates
// ============================================================

const STEPS = [
    {
        label: "نقرة 1",
        x: 40,
        y: 445,
        type: "click"
    },

    {
        label: "نقرة 2",
        x: 556,
        y: 29,
        type: "click"
    },

    {
        label: "نقرة 3",
        x: 516,
        y: 75,
        type: "click"
    },

    {
        label: "نقرة 4",
        x: 176,
        y: 341,
        type: "click"
    },

    {
        label: "حقل الإيميل",
        x: 268,
        y: 127,
        type: "email"
    },

    {
        label: "حقل الباسورد",
        x: 262,
        y: 197,
        type: "password"
    },

    {
        label: "زر الدخول",
        x: 243,
        y: 281,
        type: "click"
    }
];

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

        if (
            executable &&
            fs.existsSync(executable)
        ) {
            return executable;
        }
    }

    return null;
}

// ============================================================
// Check CDP
// ============================================================

function isCDPAvailable() {

    return new Promise(resolve => {

        const request = http.get(
            `http://127.0.0.1:${CDP_PORT}/json/version`,
            response => {

                resolve(
                    response.statusCode === 200
                );
            }
        );

        request.on(
            "error",
            () => resolve(false)
        );

        request.setTimeout(
            1500,
            () => {
                request.destroy();
                resolve(false);
            }
        );
    });
}

// ============================================================
// Wait CDP
// ============================================================

async function waitForCDP(
    timeout = 20000
) {

    const start = Date.now();

    while (
        Date.now() - start <
        timeout
    ) {

        if (
            await isCDPAvailable()
        ) {
            return true;
        }

        await sleep(500);
    }

    return false;
}

// ============================================================
// Start Real Chrome
// ============================================================

async function startChrome() {

    const chromePath =
        findChrome();

    if (!chromePath) {

        throw new Error(
            "❌ لم يتم العثور على Google Chrome."
        );
    }

    const profileDir =
        path.join(
            os.tmpdir(),
            "wolf-real-chrome-profile"
        );

    fs.mkdirSync(
        profileDir,
        {
            recursive: true
        }
    );

    console.log("");
    console.log(
        "🚀 تشغيل Google Chrome الحقيقي..."
    );

    console.log(
        `🌐 ${chromePath}`
    );

    const chrome =
        spawn(
            chromePath,
            [
                `--remote-debugging-port=${CDP_PORT}`,

                `--user-data-dir=${profileDir}`,

                `--window-size=${WIDTH},${HEIGHT}`,

                "--lang=ar-SA",

                "--accept-lang=ar-SA,ar,en-US,en",

                "--no-first-run",

                "--no-default-browser-check",

                "--disable-session-crashed-bubble",

                WOLF_URL
            ],
            {
                detached: true,
                stdio: "ignore"
            }
        );

    chrome.unref();

    console.log(
        "⏳ انتظار Chrome..."
    );

    const ready =
        await waitForCDP();

    if (!ready) {

        throw new Error(
            "❌ Chrome لم يفتح CDP على 9222."
        );
    }

    console.log(
        "✅ Chrome جاهز"
    );
}

// ============================================================
// Get WOLF Page
// ============================================================

async function getWolfPage(
    browser
) {

    let pages =
        await browser.pages();

    console.log("");
    console.log(
        `📄 عدد التبويبات: ${pages.length}`
    );

    for (
        let i = 0;
        i < pages.length;
        i++
    ) {

        console.log(
            `   ${i + 1}. ${pages[i].url()}`
        );
    }

    let page =
        pages.find(
            p =>
                p.url().includes(
                    "wolf.live"
                )
        );

    if (!page) {

        page =
            pages.length
                ? pages[0]
                : await browser.newPage();

        await page.goto(
            WOLF_URL,
            {
                waitUntil:
                    "domcontentloaded",
                timeout: 60000
            }
        );
    }

    return page;
}

// ============================================================
// Coordinate Calculation
// ============================================================

async function calculateCoordinates(
    page,
    x,
    y
) {

    const info =
        await page.evaluate(
            () => ({
                width:
                    window.innerWidth,

                height:
                    window.innerHeight
            })
        );

    let newX = x;
    let newY = y;

    if (
        info.width !== WIDTH ||
        info.height !== HEIGHT
    ) {

        newX =
            Math.round(
                x *
                info.width /
                WIDTH
            );

        newY =
            Math.round(
                y *
                info.height /
                HEIGHT
            );
    }

    return {
        x: newX,
        y: newY
    };
}

// ============================================================
// Click
// ============================================================

async function clickAt(
    page,
    step
) {

    const pos =
        await calculateCoordinates(
            page,
            step.x,
            step.y
        );

    console.log("");
    console.log(
        `🖱️ ${step.label}`
    );

    console.log(
        `📍 X=${pos.x} Y=${pos.y}`
    );

    await page.mouse.move(
        pos.x,
        pos.y,
        {
            steps: 10
        }
    );

    await sleep(300);

    await page.mouse.click(
        pos.x,
        pos.y
    );

    console.log(
        "✅ تم النقر"
    );

    await sleep(1500);
}

// ============================================================
// Type
// ============================================================

async function typeAt(
    page,
    step,
    value
) {

    const pos =
        await calculateCoordinates(
            page,
            step.x,
            step.y
        );

    console.log("");
    console.log(
        `⌨️ ${step.label}`
    );

    console.log(
        `📍 X=${pos.x} Y=${pos.y}`
    );

    await page.mouse.click(
        pos.x,
        pos.y
    );

    await sleep(300);

    await page.keyboard.down(
        "Control"
    );

    await page.keyboard.press("A");

    await page.keyboard.up(
        "Control"
    );

    await page.keyboard.press(
        "Backspace"
    );

    await page.keyboard.type(
        value,
        {
            delay: 50
        }
    );

    console.log(
        "✅ تم إدخال البيانات"
    );

    await sleep(1000);
}

// ============================================================
// Perform Login
// ============================================================

async function performLogin(
    page
) {

    if (
        !WOLF_EMAIL ||
        !WOLF_PASSWORD
    ) {

        throw new Error(
            "❌ WOLF_EMAIL أو WOLF_PASSWORD غير موجود."
        );
    }

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🔐 بدء تسجيل الدخول"
    );

    console.log(
        "========================================"
    );

    console.log(
        `📧 Email: ${mask(WOLF_EMAIL)}`
    );

    for (
        const step of STEPS
    ) {

        if (
            step.type === "email"
        ) {

            await typeAt(
                page,
                step,
                WOLF_EMAIL
            );

        } else if (
            step.type === "password"
        ) {

            await typeAt(
                page,
                step,
                WOLF_PASSWORD
            );

        } else {

            await clickAt(
                page,
                step
            );
        }
    }

    console.log("");
    console.log(
        "✅ تم تنفيذ جميع خطوات الدخول"
    );
}

// ============================================================
// Read Credentials
// ============================================================

async function readCredentials(
    page
) {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🔐 قراءة WOLF credentials"
    );

    console.log(
        "========================================"
    );

    let lastData = null;

    // نعطي WOLF وقتًا لتحديث localStorage
    for (
        let attempt = 1;
        attempt <= 10;
        attempt++
    ) {

        lastData =
            await page.evaluate(
                () => {

                    const result = {};

                    for (
                        let i = 0;
                        i < localStorage.length;
                        i++
                    ) {

                        const key =
                            localStorage.key(i);

                        if (!key) {
                            continue;
                        }

                        result[key] =
                            localStorage.getItem(
                                key
                            );
                    }

                    return result;
                }
            );

        const token =
            lastData?.v3APIToken;

        const appCheckToken =
            lastData?.appCheckToken;

        console.log(
            `🔎 محاولة ${attempt}/10`
        );

        console.log(
            `   v3APIToken: ${
                token
                    ? mask(token)
                    : "غير موجود"
            }`
        );

        console.log(
            `   appCheckToken: ${
                appCheckToken
                    ? mask(appCheckToken)
                    : "غير موجود"
            }`
        );

        if (
            token &&
            appCheckToken
        ) {

            console.log(
                "✅ تم العثور على جميع credentials"
            );

            return {
                token:
                    String(token).trim(),

                appCheckToken:
                    String(
                        appCheckToken
                    ).trim(),

                device: "web",

                isAppCheckEnabled:
                    true
            };
        }

        await sleep(3000);
    }

    throw new Error(
        "❌ لم يتم العثور على v3APIToken و appCheckToken."
    );
}

// ============================================================
// Load Session
// ============================================================

export async function loadSession() {

    console.log("");
    console.log(
        "🐺 WOLF LOGIN LOADER"
    );

    // --------------------------------------------------------
    // Chrome
    // --------------------------------------------------------

    if (
        !(await isCDPAvailable())
    ) {

        await startChrome();

    } else {

        console.log(
            "✅ Chrome/CDP يعمل مسبقًا"
        );
    }

    // --------------------------------------------------------
    // Puppeteer -> Real Chrome
    // --------------------------------------------------------

    console.log(
        "🔌 الاتصال بـ Google Chrome..."
    );

    const browser =
        await puppeteer.connect({
            browserURL:
                `http://127.0.0.1:${CDP_PORT}`,

            defaultViewport: null
        });

    console.log(
        "✅ تم الاتصال بـ Chrome الحقيقي"
    );

    // --------------------------------------------------------
    // Page
    // --------------------------------------------------------

    const page =
        await getWolfPage(
            browser
        );

    // --------------------------------------------------------
    // Make sure WOLF page
    // --------------------------------------------------------

    if (
        !page.url().includes(
            "wolf.live"
        )
    ) {

        await page.goto(
            WOLF_URL,
            {
                waitUntil:
                    "domcontentloaded",
                timeout: 60000
            }
        );
    }

    // --------------------------------------------------------
    // Viewport
    // --------------------------------------------------------

    try {

        await page.setViewport({
            width: WIDTH,
            height: HEIGHT,
            deviceScaleFactor: 1
        });

    } catch {}

    // --------------------------------------------------------
    // Language
    // --------------------------------------------------------

    try {

        await page.setExtraHTTPHeaders({
            "Accept-Language":
                "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7"
        });

    } catch {}

    console.log(
        "🌐 WOLF: " + page.url()
    );

    console.log(
        "🇸🇦 اللغة: العربية"
    );

    console.log(
        "⏳ انتظار تحميل WOLF..."
    );

    await sleep(5000);

    // --------------------------------------------------------
    // Login
    // --------------------------------------------------------

    await performLogin(
        page
    );

    // --------------------------------------------------------
    // Wait
    // --------------------------------------------------------

    console.log("");
    console.log(
        "⏳ انتظار اكتمال تسجيل الدخول..."
    );

    await sleep(10000);

    // --------------------------------------------------------
    // Credentials
    // --------------------------------------------------------

    const credentials =
        await readCredentials(
            page
        );

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "✅ WOLF LOGIN SUCCESS"
    );

    console.log(
        `🔐 v3APIToken: ${mask(credentials.token)}`
    );

    console.log(
        `🛡️ appCheckToken: ${mask(credentials.appCheckToken)}`
    );

    console.log(
        "📱 Device: web"
    );

    console.log(
        "🛡️ App Check: true"
    );

    console.log(
        "========================================"
    );

    return credentials;
}

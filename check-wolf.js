import puppeteer from "puppeteer";
import wolfjs from "wolf.js";
import { io } from "socket.io-client";

// ============================================================
// WOLF
// ============================================================

const { WOLF, OnlineState } = wolfjs;

// ============================================================
// إعدادات
// ============================================================

const GROUP_ID = 18432094;

const WATCHED_SUBSCRIBER_IDS = [
    51660277,
    35543686,
    80014666,
    16327118,
    5507
];

const LEAVE_COMMAND = "!كات نزول";
const JOIN_COMMAND = "!كات صعود";

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

const MAX_OCCUPANTS_TO_JOIN = 1;

const AUTHORIZATION_TIMEOUT_MS = 30 * 1000;

// ============================================================
// Chrome
// ============================================================

const CHROME_PATH = process.env.CHROME_PATH;

if (!CHROME_PATH) {
    console.error("❌ CHROME_PATH غير موجود");
    console.error("❌ يجب تشغيل البرنامج من GitHub Actions بعد تثبيت Chrome");
    process.exit(1);
}

// ============================================================
// متغيرات
// ============================================================

let browser = null;
let page = null;

let service = null;
let socket = null;

let monitorTimer = null;

let autoCheckEnabled = true;
let currentSlotId = null;

let shuttingDown = false;

// ============================================================
// أدوات
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// تنظيف النصوص
// ============================================================

function normalizeText(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

// ============================================================
// قراءة sender ID
// ============================================================

function getSenderId(data) {
    return (
        data?.sourceSubscriberId ??
        data?.senderId ??
        data?.sender?.id ??
        data?.subscriberId ??
        data?.sourceSubscriber?.id ??
        data?.message?.senderId ??
        data?.message?.sender?.id ??
        null
    );
}

// ============================================================
// قراءة الرسالة
// ============================================================

function getMessageText(data) {
    return normalizeText(
        data?.body ??
        data?.text ??
        data?.message ??
        data?.message?.body ??
        data?.message?.text ??
        data?.content ??
        ""
    );
}

// ============================================================
// تشغيل Chrome الرسمي
// ============================================================

async function startChrome() {
    console.log("");
    console.log("========================================");
    console.log("🌐 تشغيل Google Chrome الرسمي");
    console.log("========================================");

    console.log("Chrome path:");
    console.log(CHROME_PATH);

    console.log("");

    browser = await puppeteer.launch({
        executablePath: CHROME_PATH,

        headless: true,

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

            "--disable-background-networking",

            "--disable-popup-blocking",

            "--disable-notifications",

            "--disable-features=Translate",

            "--disable-session-crashed-bubble"
        ]
    });

    console.log("✅ تم تشغيل Google Chrome");

    console.log(
        "Chrome version:",
        await browser.version()
    );

    const pages = await browser.pages();

    page = pages[0];

    if (!page) {
        page = await browser.newPage();
    }

    await page.setViewport({
        width: 600,
        height: 600,
        deviceScaleFactor: 1
    });

    await page.setExtraHTTPHeaders({
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7"
    });

    page.on("console", msg => {
        const text = msg.text();

        if (
            text.includes("WOLF") ||
            text.includes("wolf") ||
            text.includes("connection") ||
            text.includes("AppCheck")
        ) {
            console.log(`[PAGE] ${text}`);
        }
    });

    page.on("pageerror", error => {
        console.error("⚠️ Page error:", error.message);
    });

    page.on("error", error => {
        console.error("⚠️ Browser page error:", error.message);
    });
}

// ============================================================
// فتح WOLF
// ============================================================

async function openWolf() {
    console.log("");
    console.log("🌐 فتح WOLF...");

    await page.goto(
        "https://wolf.live/mna",
        {
            waitUntil: "domcontentloaded",
            timeout: 120000
        }
    );

    console.log("✅ WOLF opened");

    await sleep(5000);

    const info = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        dpr: window.devicePixelRatio,
        url: location.href,
        userAgent: navigator.userAgent
    }));

    console.log("");
    console.log("📐 معلومات الصفحة");
    console.log("innerWidth :", info.innerWidth);
    console.log("innerHeight:", info.innerHeight);
    console.log("outerWidth :", info.outerWidth);
    console.log("outerHeight:", info.outerHeight);
    console.log("DPR        :", info.dpr);
    console.log("URL        :", info.url);

    console.log("");
    console.log("🌐 Browser:");
    console.log(info.userAgent);
}

// ============================================================
// تنفيذ النقرة
// ============================================================

async function clickAt(x, y) {
    await page.mouse.click(x, y);
    await sleep(700);
}

// ============================================================
// الكتابة
// ============================================================

async function typeAt(x, y, text) {
    await page.mouse.click(x, y);

    await sleep(300);

    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");

    await page.keyboard.type(text, {
        delay: 30
    });

    await sleep(500);
}

// ============================================================
// تسجيل الدخول
// ============================================================

async function loginToWolf() {
    const email = process.env.WOLF_EMAIL;
    const password = process.env.WOLF_PASSWORD;

    if (!email || !password) {
        throw new Error(
            "❌ WOLF_EMAIL أو WOLF_PASSWORD غير موجود في GitHub Secrets"
        );
    }

    console.log("");
    console.log("========================================");
    console.log("🔐 بدء تسجيل الدخول");
    console.log("========================================");

    // نقرة 1
    console.log("🖱️ نقرة 1...");
    await clickAt(40, 445);

    // نقرة 2
    console.log("🖱️ نقرة 2...");
    await clickAt(556, 29);

    // نقرة 3
    console.log("🖱️ نقرة 3...");
    await clickAt(516, 75);

    // نقرة 4
    console.log("🖱️ نقرة 4...");
    await clickAt(176, 341);

    // Email
    console.log("📧 كتابة الإيميل...");
    await typeAt(268, 127, email);

    // Password
    console.log("🔑 كتابة الباسورد...");
    await typeAt(262, 197, password);

    // Login
    console.log("🖱️ زر الدخول...");
    await clickAt(243, 281);

    console.log("✅ انتهت خطوات الدخول");

    console.log("⏳ انتظار اكتمال تسجيل الدخول...");

    await sleep(10000);
}

// ============================================================
// قراءة LocalStorage
// ============================================================

async function readWolfStorage() {
    console.log("");
    console.log("========================================");
    console.log("🔐 قراءة WOLF credentials");
    console.log("========================================");

    for (let attempt = 1; attempt <= 30; attempt++) {

        console.log(`🔎 محاولة ${attempt}/30`);

        const result = await page.evaluate(() => {

            const local = {};

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);

                if (key) {
                    local[key] = localStorage.getItem(key);
                }
            }

            const session = {};

            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);

                if (key) {
                    session[key] = sessionStorage.getItem(key);
                }
            }

            return {
                url: location.href,
                localKeys: Object.keys(local),
                sessionKeys: Object.keys(session),

                v3APIToken:
                    local.v3APIToken ||
                    session.v3APIToken ||
                    null,

                appCheckToken:
                    local.appCheckToken ||
                    session.appCheckToken ||
                    local.app_check_token ||
                    session.app_check_token ||
                    null,

                deviceToken:
                    local.deviceToken ||
                    session.deviceToken ||
                    null
            };
        });

        console.log(
            "   v3APIToken:",
            result.v3APIToken ? "موجود" : "غير موجود"
        );

        console.log(
            "   appCheckToken:",
            result.appCheckToken ? "موجود" : "غير موجود"
        );

        console.log(
            "   deviceToken:",
            result.deviceToken ? "موجود" : "غير موجود"
        );

        if (result.v3APIToken && result.appCheckToken) {

            console.log("");
            console.log("✅ تم الحصول على credentials");

            return {
                token: result.v3APIToken,
                appCheckToken: result.appCheckToken,
                deviceToken: result.deviceToken
            };
        }

        await sleep(2000);
    }

    throw new Error(
        "❌ لم يتم العثور على appCheckToken بعد 30 محاولة"
    );
}

// ============================================================
// إنشاء WOLF Service
// ============================================================

async function createWolfService(credentials) {

    console.log("");
    console.log("========================================");
    console.log("🐺 إنشاء WOLF service");
    console.log("========================================");

    service = new WOLF();

    // Token
    service.config.framework.login.token =
        credentials.token;

    // App Check
    service.config.framework.login.appCheckToken =
        credentials.appCheckToken;

    // Invisible
    service.config.framework.login.onlineState =
        OnlineState.INVISIBLE;

    console.log("✅ WOLF service created");

    console.log("🔐 token: موجود");
    console.log("🛡️ appCheckToken: موجود");
    console.log("👻 onlineState: INVISIBLE");
}

// ============================================================
// تشغيل WOLF websocket
// ============================================================

async function initializeWolfSocket() {

    console.log("");
    console.log("========================================");
    console.log("📡 تهيئة WOLF WebSocket");
    console.log("========================================");

    await service.websocket.init();

    console.log("✅ websocket.init() completed");
}

// ============================================================
// Socket.IO
// ============================================================

async function connectSocketIO(credentials) {

    console.log("");
    console.log("========================================");
    console.log("📡 Socket.IO");
    console.log("========================================");

    const connection =
        service?._frameworkConfig?.get?.("connection");

    const host =
        connection?.host ||
        "https://v3-rc.palringo.com";

    const port =
        connection?.port ??
        443;

    const state =
        service.config.framework.login.onlineState;

    console.log("Host:", host);
    console.log("Port:", port);

    socket = io(`${host}:${port}`, {

        transports: [
            "websocket"
        ],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 2000,

        autoConnect: false,

        query: {

            token:
                credentials.token,

            device:
                "web",

            state,

            version:
                connection?.version || undefined,

            isAppCheckEnabled:
                "true",

            appCheckToken:
                credentials.appCheckToken
        }
    });

    service.websocket.socket = socket;

    socket.on("connect", () => {

        console.log(
            "🟢 Socket.IO connected:",
            socket.id
        );
    });

    socket.on("connect_error", error => {

        console.error(
            "❌ Socket.IO connect_error:",
            error?.message || error
        );
    });

    socket.on("disconnect", reason => {

        console.log(
            "🔴 Socket.IO disconnected:",
            reason
        );
    });

    socket.onAny((eventName, data) => {

        try {

            const handler =
                service?.websocket?.handlers?.[eventName];

            if (
                handler &&
                typeof handler.process === "function"
            ) {

                handler.process(
                    data?.body ?? data
                );
            }

        } catch (error) {

            console.error(
                `❌ Error processing ${eventName}:`,
                error?.message || error
            );
        }
    });

    socket.connect();

    await waitForAuthorization();
}

// ============================================================
// انتظار Authorization
// ============================================================

async function waitForAuthorization() {

    console.log("");
    console.log("⏳ انتظار WOLF authorization...");

    const started =
        Date.now();

    while (
        Date.now() - started <
        AUTHORIZATION_TIMEOUT_MS
    ) {

        const subscriber =
            service?.currentSubscriber;

        if (subscriber?.id) {

            console.log("");
            console.log("========================================");
            console.log("✅ WOLF authorization completed");
            console.log("========================================");

            console.log(
                "Subscriber ID:",
                subscriber.id
            );

            console.log(
                "Subscriber name:",
                subscriber.name ||
                subscriber.username ||
                "Unknown"
            );

            return;
        }

        await sleep(500);
    }

    throw new Error(
        "❌ Timeout waiting for WOLF authorization"
    );
}

// ============================================================
// Stage
// ============================================================

async function getStageSlots() {

    await service.stage.getAudioConfig(
        GROUP_ID
    );

    const slots =
        await service.stage.slot.list(
            GROUP_ID
        );

    return slots || [];
}

// ============================================================
// فحص Stage
// ============================================================

async function checkStageAndJoin() {

    if (shuttingDown) {
        return;
    }

    if (!autoCheckEnabled) {
        return;
    }

    console.log("");
    console.log("========================================");
    console.log("🎙️ فحص Stage");
    console.log("========================================");

    try {

        const slots =
            await getStageSlots();

        console.log(
            "عدد الـ slots:",
            slots.length
        );

        const occupiedSlots =
            slots.filter(
                slot =>
                    !!slot?.occupierId
            );

        console.log(
            "عدد الموجودين:",
            occupiedSlots.length
        );

        // هل البوت موجود أصلاً؟
        const myId =
            service?.currentSubscriber?.id;

        const mySlot =
            slots.find(
                slot =>
                    String(slot?.occupierId) ===
                    String(myId)
            );

        if (mySlot) {

            currentSlotId =
                mySlot.id;

            console.log(
                "✅ البوت موجود على Stage"
            );

            console.log(
                "Slot:",
                currentSlotId
            );

            return;
        }

        if (
            occupiedSlots.length >
            MAX_OCCUPANTS_TO_JOIN
        ) {

            console.log(
                `⏸️ العدد ${occupiedSlots.length} — لن أدخل`
            );

            return;
        }

        const freeSlot =
            slots.find(
                slot =>
                    !slot?.occupierId
            );

        if (!freeSlot) {

            console.log(
                "⚠️ لا يوجد Slot فاضي"
            );

            return;
        }

        console.log(
            "🎙️ Slot فاضي:",
            freeSlot.id
        );

        console.log(
            "🚀 محاولة الدخول..."
        );

        await service.stage.slot.join(
            GROUP_ID,
            freeSlot.id
        );

        currentSlotId =
            freeSlot.id;

        console.log(
            "✅ تم الدخول إلى Stage"
        );

        // بعد الدخول نوقف الفحص التلقائي
        autoCheckEnabled = false;

        if (monitorTimer) {

            clearInterval(
                monitorTimer
            );

            monitorTimer = null;
        }

    } catch (error) {

        console.error(
            "❌ خطأ في Stage:",
            error?.message ||
            error
        );
    }
}

// ============================================================
// الخروج من Stage
// ============================================================

async function leaveStage() {

    try {

        if (!currentSlotId) {

            const slots =
                await getStageSlots();

            const myId =
                service?.currentSubscriber?.id;

            const mySlot =
                slots.find(
                    slot =>
                        String(slot?.occupierId) ===
                        String(myId)
                );

            if (mySlot) {

                currentSlotId =
                    mySlot.id;
            }
        }

        if (!currentSlotId) {

            console.log(
                "ℹ️ البوت ليس على Stage"
            );

            return;
        }

        console.log(
            "🚪 الخروج من Stage..."
        );

        await service.stage.slot.leave(
            GROUP_ID,
            currentSlotId
        );

        console.log(
            "✅ تم الخروج من Stage"
        );

        currentSlotId =
            null;

    } catch (error) {

        console.error(
            "❌ خطأ أثناء الخروج:",
            error?.message ||
            error
        );
    }
}

// ============================================================
// دخول إجباري
// ============================================================

async function forceJoinStage() {

    console.log("");
    console.log(
        "🚀 دخول إجباري إلى Stage"
    );

    try {

        const slots =
            await getStageSlots();

        const myId =
            service?.currentSubscriber?.id;

        const mySlot =
            slots.find(
                slot =>
                    String(slot?.occupierId) ===
                    String(myId)
            );

        if (mySlot) {

            currentSlotId =
                mySlot.id;

            console.log(
                "ℹ️ البوت موجود بالفعل"
            );

            return;
        }

        const freeSlot =
            slots.find(
                slot =>
                    !slot?.occupierId
            );

        if (!freeSlot) {

            console.log(
                "❌ لا يوجد Slot فاضي"
            );

            return;
        }

        await service.stage.slot.join(
            GROUP_ID,
            freeSlot.id
        );

        currentSlotId =
            freeSlot.id;

        console.log(
            "✅ تم الدخول الإجباري"
        );

        autoCheckEnabled =
            false;

        if (monitorTimer) {

            clearInterval(
                monitorTimer
            );

            monitorTimer = null;
        }

    } catch (error) {

        console.error(
            "❌ خطأ في الدخول الإجباري:",
            error?.message ||
            error
        );
    }
}

// ============================================================
// Private Messages
// ============================================================

function setupPrivateMessages() {

    console.log("");
    console.log(
        "📨 تشغيل مراقبة الرسائل الخاصة"
    );

    const possibleEvents = [
        "privateMessage",
        "private_message",
        "message",
        "chatMessage",
        "chat_message"
    ];

    for (const eventName of possibleEvents) {

        socket?.on(
            eventName,
            async data => {

                try {

                    const senderId =
                        getSenderId(data);

                    const text =
                        getMessageText(data);

                    if (!senderId) {
                        return;
                    }

                    if (!text) {
                        return;
                    }

                    const watched =
                        WATCHED_SUBSCRIBER_IDS
                            .map(String)
                            .includes(
                                String(senderId)
                            );

                    if (!watched) {
                        return;
                    }

                    console.log("");
                    console.log(
                        "📨 [PRIVATE]",
                        senderId,
                        ":",
                        text
                    );

                    if (
                        text ===
                        LEAVE_COMMAND
                    ) {

                        console.log(
                            "📥 أمر النزول"
                        );

                        autoCheckEnabled =
                            false;

                        await leaveStage();

                        autoCheckEnabled =
                            true;

                        startMonitor();

                        return;
                    }

                    if (
                        text ===
                        JOIN_COMMAND
                    ) {

                        console.log(
                            "📥 أمر الصعود"
                        );

                        await forceJoinStage();

                        return;
                    }

                } catch (error) {

                    console.error(
                        "❌ Private message error:",
                        error?.message ||
                        error
                    );
                }
            }
        );
    }

    console.log(
        "✅ Private command listener active"
    );
}

// ============================================================
// Monitor
// ============================================================

function startMonitor() {

    if (shuttingDown) {
        return;
    }

    if (monitorTimer) {

        clearInterval(
            monitorTimer
        );
    }

    autoCheckEnabled =
        true;

    monitorTimer =
        setInterval(
            () => {

                checkStageAndJoin()
                    .catch(error => {

                        console.error(
                            "❌ Monitor error:",
                            error?.message ||
                            error
                        );
                    });

            },
            CHECK_INTERVAL_MS
        );

    console.log(
        "⏱️ Stage monitor:",
        "كل 10 دقائق"
    );
}

// ============================================================
// Main
// ============================================================

async function main() {

    try {

        console.log("");
        console.log("========================================");
        console.log("🐺 WOLF BOT");
        console.log("========================================");

        console.log(
            "Node:",
            process.version
        );

        console.log(
            "Chrome:",
            CHROME_PATH
        );

        console.log("========================================");

        // Chrome
        await startChrome();

        // WOLF
        await openWolf();

        // Login
        await loginToWolf();

        // Credentials
        const credentials =
            await readWolfStorage();

        // WOLF service
        await createWolfService(
            credentials
        );

        // websocket
        await initializeWolfSocket();

        // socket.io
        await connectSocketIO(
            credentials
        );

        // private messages
        setupPrivateMessages();

        console.log("");
        console.log("========================================");
        console.log("🐺 WOLF is running");
        console.log("========================================");

        console.log(
            "Group:",
            GROUP_ID
        );

        console.log(
            "Max occupants:",
            MAX_OCCUPANTS_TO_JOIN
        );

        console.log(
            "Check interval:",
            "10 minutes"
        );

        // أول فحص
        await checkStageAndJoin();

        // تشغيل المراقبة
        startMonitor();

        // منع انتهاء process
        process.stdin.resume();

    } catch (error) {

        console.error("");
        console.error("========================================");
        console.error("❌ حصل خطأ");
        console.error("========================================");

        console.error(
            error?.stack ||
            error
        );

        process.exitCode = 1;
    }
}

// ============================================================
// Shutdown
// ============================================================

async function shutdown(signal) {

    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log("");
    console.log(
        `🛑 Shutdown: ${signal}`
    );

    try {

        if (monitorTimer) {

            clearInterval(
                monitorTimer
            );

            monitorTimer =
                null;
        }

        if (socket) {

            socket.disconnect();

            socket =
                null;
        }

        if (browser) {

            await browser.close();

            browser =
                null;
        }

    } catch (error) {

        console.error(
            "Shutdown error:",
            error?.message ||
            error
        );
    }

    process.exit(0);
}

// ============================================================
// Signals
// ============================================================

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

// ============================================================
// Start
// ============================================================

main();

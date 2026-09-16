import puppeteer from "puppeteer";
import wolfjs from "wolf.js";
import { io } from "socket.io-client";

const { WOLF, OnlineState } = wolfjs;

// ============================================================
// CONFIG
// ============================================================

const WOLF_URL = "https://wolf.live/mna";

const WIDTH = 600;
const HEIGHT = 600;

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

// GitHub Secrets / Environment Variables
const WOLF_EMAIL = "mona24682@gmail.com";
const WOLF_PASSWORD = "As1412as";

// ============================================================
// LOGIN COORDINATES
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
// VARIABLES
// ============================================================

let service = null;
let socket = null;

let monitorTimer = null;

let autoCheckEnabled = true;
let currentSlotId = null;

let shuttingDown = false;

// ============================================================
// HELPERS
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function maskToken(value) {

    if (!value) {
        return "غير موجود";
    }

    const text = String(value);

    if (text.length <= 16) {
        return `${text.slice(0, 4)}...${text.slice(-4)}`;
    }

    return `${text.slice(0, 8)}...${text.slice(-8)}`;
}

function isWatchedSubscriber(id) {

    return WATCHED_SUBSCRIBER_IDS.includes(
        Number(id)
    );
}

// ============================================================
// VERIFY ENV
// ============================================================

function verifyCredentials() {

    if (!WOLF_EMAIL || !WOLF_PASSWORD) {

        throw new Error(
            "❌ WOLF_EMAIL أو WOLF_PASSWORD غير موجود في Environment Variables."
        );
    }

    console.log(
        `📧 Email: ${maskToken(WOLF_EMAIL)}`
    );
}

// ============================================================
// GET PAGE
// ============================================================

async function getWolfPage(browser) {

    let pages = await browser.pages();

    console.log("");
    console.log(
        `📄 عدد التبويبات: ${pages.length}`
    );

    for (let i = 0; i < pages.length; i++) {

        try {
            console.log(
                `   ${i + 1}. ${pages[i].url()}`
            );
        } catch {}
    }

    let page = pages.find(page => {

        try {
            return page.url().includes("wolf.live");
        } catch {
            return false;
        }

    });

    if (!page) {

        console.log(
            "🌐 إنشاء صفحة WOLF..."
        );

        page = pages.length
            ? pages[0]
            : await browser.newPage();

        await page.goto(
            WOLF_URL,
            {
                waitUntil: "domcontentloaded",
                timeout: 60000
            }
        );
    }

    return page;
}

// ============================================================
// PREPARE PAGE
// ============================================================

async function preparePage(page) {

    console.log("");
    console.log(
        "🌐 WOLF URL:",
        page.url()
    );

    try {

        await page.setViewport({
            width: WIDTH,
            height: HEIGHT,
            deviceScaleFactor: 1
        });

    } catch {}

    try {

        await page.setExtraHTTPHeaders({
            "Accept-Language":
                "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7"
        });

    } catch {}

    console.log(
        "🇸🇦 اللغة: العربية"
    );

    console.log(
        "📐 Viewport:",
        `${WIDTH}x${HEIGHT}`
    );

    console.log(
        "⏳ انتظار تحميل WOLF..."
    );

    await sleep(5000);
}

// ============================================================
// VIEWPORT
// ============================================================

async function printViewport(page) {

    const info = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio,
        url: location.href
    }));

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "📐 معلومات الصفحة"
    );

    console.log(
        "========================================"
    );

    console.log(
        "innerWidth :",
        info.innerWidth
    );

    console.log(
        "innerHeight:",
        info.innerHeight
    );

    console.log(
        "outerWidth :",
        info.outerWidth
    );

    console.log(
        "outerHeight:",
        info.outerHeight
    );

    console.log(
        "DPR        :",
        info.devicePixelRatio
    );

    console.log(
        "URL        :",
        info.url
    );

    console.log(
        "========================================"
    );

    return info;
}

// ============================================================
// COORDINATES
// ============================================================

async function calculateCoordinates(
    page,
    x,
    y
) {

    const info = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight
    }));

    let newX = x;
    let newY = y;

    if (
        info.width !== WIDTH ||
        info.height !== HEIGHT
    ) {

        newX = Math.round(
            x * info.width / WIDTH
        );

        newY = Math.round(
            y * info.height / HEIGHT
        );
    }

    return {
        x: newX,
        y: newY
    };
}

// ============================================================
// CLICK
// ============================================================

async function clickAt(
    page,
    x,
    y,
    label
) {

    const pos =
        await calculateCoordinates(
            page,
            x,
            y
        );

    console.log(
        `🖱️ ${label}: X=${pos.x} Y=${pos.y}`
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

    await sleep(1500);
}

// ============================================================
// TYPE
// ============================================================

async function typeAt(
    page,
    x,
    y,
    value,
    label
) {

    const pos =
        await calculateCoordinates(
            page,
            x,
            y
        );

    console.log(
        `⌨️ ${label}: X=${pos.x} Y=${pos.y}`
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

    await sleep(1000);
}

// ============================================================
// LOGIN
// ============================================================

async function performLogin(page) {

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

    for (const step of STEPS) {

        if (step.type === "email") {

            await typeAt(
                page,
                step.x,
                step.y,
                WOLF_EMAIL,
                step.label
            );

        } else if (step.type === "password") {

            await typeAt(
                page,
                step.x,
                step.y,
                WOLF_PASSWORD,
                step.label
            );

        } else {

            await clickAt(
                page,
                step.x,
                step.y,
                step.label
            );
        }
    }

    console.log(
        "✅ انتهت خطوات الدخول"
    );
}

// ============================================================
// CHECK LOGIN
// ============================================================

async function checkAfterLogin(page) {

    console.log("");
    console.log(
        "⏳ انتظار اكتمال تسجيل الدخول..."
    );

    await sleep(10000);

    console.log(
        "🌐 URL:",
        page.url()
    );

    try {

        const text = await page.evaluate(() => {

            return document.body
                ? document.body.innerText
                : "";

        });

        const lower =
            text.toLowerCase();

        if (
            lower.includes("فقدان الاتصال") ||
            lower.includes("انقطع الاتصال") ||
            lower.includes("connection lost") ||
            lower.includes("disconnected")
        ) {

            console.log(
                "⚠️ ظهرت رسالة فقدان الاتصال"
            );

        } else {

            console.log(
                "✅ لا توجد رسالة فقدان اتصال"
            );
        }

    } catch {

        console.log(
            "⚠️ تعذر فحص نص الصفحة"
        );
    }
}

// ============================================================
// READ CREDENTIALS
// ============================================================

async function readCredentials(page) {

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

    for (let attempt = 1; attempt <= 20; attempt++) {

        const data = await page.evaluate(() => {

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
                    localStorage.getItem(key);
            }

            return result;
        });

        const token =
            data?.v3APIToken;

        const appCheckToken =
            data?.appCheckToken;

        console.log(
            `🔎 محاولة ${attempt}/20`
        );

        console.log(
            `   v3APIToken: ${maskToken(token)}`
        );

        console.log(
            `   appCheckToken: ${maskToken(appCheckToken)}`
        );

        if (
            token &&
            appCheckToken
        ) {

            console.log(
                "✅ تم العثور على credentials"
            );

            return {
                token: String(token).trim(),

                appCheckToken:
                    String(
                        appCheckToken
                    ).trim(),

                device: "web",

                isAppCheckEnabled: true
            };
        }

        await sleep(3000);
    }

    throw new Error(
        "❌ لم يتم العثور على v3APIToken و appCheckToken."
    );
}

// ============================================================
// CREATE WOLF SERVICE
// ============================================================

function createWolfService(credentials) {

    console.log("");
    console.log(
        "🐺 إنشاء wolf.js 2.7.10..."
    );

    service =
        new WOLF();

    service.config.framework.login.token =
        credentials.token;

    service.config.framework.login.onlineState =
        OnlineState.INVISIBLE;

    service.config.framework.login.appCheckToken =
        credentials.appCheckToken;

    console.log(
        "🔐 Token:",
        maskToken(credentials.token)
    );

    console.log(
        "🛡️ AppCheck:",
        maskToken(
            credentials.appCheckToken
        )
    );

    console.log(
        "👻 Online State: Invisible"
    );

    return service;
}

// ============================================================
// INITIALIZE HANDLERS
// ============================================================

async function initializeWolfHandlers() {

    console.log(
        "⚙️ [WOLF] تهيئة handlers..."
    );

    await service.websocket.init();

    const count =
        Object.keys(
            service.websocket.handlers || {}
        ).length;

    console.log(
        `⚙️ [WOLF] Loaded ${count} handlers`
    );
}

// ============================================================
// PRIVATE COMMANDS
// ============================================================

function setupPrivateCommandListener() {

    service.on(
        "privateMessage",
        async message => {

            try {

                const senderId =
                    Number(
                        message?.sourceSubscriberId ??
                        message?.senderId ??
                        message?.sender?.id ??
                        message?.subscriberId
                    );

                const text =
                    String(
                        message?.body ??
                        message?.text ??
                        message?.message ??
                        ""
                    ).trim();

                if (
                    !senderId ||
                    !text
                ) {
                    return;
                }

                if (
                    !isWatchedSubscriber(
                        senderId
                    )
                ) {
                    return;
                }

                console.log(
                    `📩 [PRIVATE] ${senderId}: ${text}`
                );

                if (
                    text === LEAVE_COMMAND
                ) {

                    await leaveStage();

                } else if (
                    text === JOIN_COMMAND
                ) {

                    await forceJoinStage();
                }

            } catch (error) {

                console.error(
                    "❌ privateMessage:",
                    error?.message ||
                    error
                );
            }
        }
    );

    console.log(
        "📡 [BOT] Private command listener active"
    );
}

// ============================================================
// CONNECT WOLF SOCKET
// ============================================================

async function connectWolfSocket(
    credentials
) {

    const connection =
        service
            ._frameworkConfig
            ?.get?.(
                "connection"
            );

    const host =
        connection?.host ||
        "https://v3-rc.palringo.com";

    const port =
        connection?.port ??
        443;

    const state =
        service
            .config
            .framework
            .login
            .onlineState;

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🔌 تشغيل WOLF API"
    );

    console.log(
        "========================================"
    );

    console.log(
        `🐺 wolf.js: 2.7.10`
    );

    console.log(
        `🌐 Host: ${host}`
    );

    console.log(
        `🔌 Port: ${port}`
    );

    socket =
        io(
            `${host}:${port}`,
            {
                transports: [
                    "websocket"
                ],

                reconnection: true,

                autoConnect: false,

                query: {

                    token:
                        credentials.token,

                    device:
                        "web",

                    state:
                        state,

                    version:
                        connection?.version ||
                        undefined,

                    isAppCheckEnabled:
                        "true",

                    appCheckToken:
                        credentials.appCheckToken
                }
            }
        );

    service.websocket.socket =
        socket;

    socket.on(
        "connect",
        () => {

            console.log(
                "🔗 [WOLF] Socket.IO connected"
            );

            console.log(
                `🔗 Socket ID: ${socket.id}`
            );
        }
    );

    socket.on(
        "connect_error",
        error => {

            console.error(
                "❌ [WOLF] Socket error:",
                error?.message ||
                error
            );
        }
    );

    socket.on(
        "disconnect",
        reason => {

            console.log(
                `🔌 [WOLF] disconnected: ${reason}`
            );
        }
    );

    socket.onAny(
        async (
            eventName,
            data
        ) => {

            try {

                const handler =
                    service
                        .websocket
                        .handlers?.[
                            eventName
                        ];

                if (!handler) {
                    return;
                }

                await handler.process(
                    data?.body ??
                    data
                );

            } catch (error) {

                console.error(
                    `❌ Handler [${eventName}]:`,
                    error?.message ||
                    error
                );
            }
        }
    );

    console.log(
        "🔌 [WOLF] Connecting..."
    );

    socket.connect();

    await waitForAuthorization();
}

// ============================================================
// AUTHORIZATION
// ============================================================

async function waitForAuthorization(
    timeout = 60000
) {

    const start =
        Date.now();

    console.log(
        "⏳ [WOLF] انتظار Authorization..."
    );

    while (
        Date.now() - start <
        timeout
    ) {

        if (
            service.currentSubscriber?.id
        ) {

            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "✅ [WOLF] Authorization complete"
            );

            console.log(
                `👤 Username: ${
                    service.currentSubscriber.username ||
                    service.currentSubscriber.nickname ||
                    "Unknown"
                }`
            );

            console.log(
                `🆔 Subscriber ID: ${
                    service.currentSubscriber.id
                }`
            );

            console.log(
                "========================================"
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
// STAGE API
// ============================================================

async function verifyStageAPI() {

    console.log(
        `🧪 [${GROUP_ID}] فحص Stage API...`
    );

    await service.stage.getAudioConfig(
        GROUP_ID
    );

    console.log(
        "✅ Stage API جاهز"
    );
}

// ============================================================
// GET SLOTS
// ============================================================

async function getStageSlots() {

    const slots =
        await service.stage.slot.list(
            GROUP_ID
        );

    return Array.isArray(slots)
        ? slots
        : [];
}

// ============================================================
// CHECK STAGE
// ============================================================

async function checkStage() {

    if (!autoCheckEnabled) {
        return;
    }

    if (currentSlotId) {
        return;
    }

    console.log(
        `🎙️ [${GROUP_ID}] فحص Stage...`
    );

    try {

        const slots =
            await getStageSlots();

        console.log(
            `📦 Slots: ${slots.length}`
        );

        const occupiedSlots =
            slots.filter(
                slot =>
                    !!slot?.occupierId
            );

        console.log(
            `👥 الموجودون: ${occupiedSlots.length}`
        );

        if (
            occupiedSlots.length >
            MAX_OCCUPANTS_TO_JOIN
        ) {

            console.log(
                "⏭️ العدد أكبر من الحد."
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
                "⚠️ لا يوجد Slot فارغ."
            );

            return;
        }

        console.log(
            `🎙️ الصعود إلى Slot ${freeSlot.id}...`
        );

        await service.stage.slot.join(
            GROUP_ID,
            freeSlot.id
        );

        currentSlotId =
            freeSlot.id;

        console.log(
            `✅ تم الصعود إلى Slot ${currentSlotId}`
        );

        autoCheckEnabled = false;

        stopMonitoring();

    } catch (error) {

        console.error(
            "❌ Stage check:",
            error?.message ||
            error
        );
    }
}

// ============================================================
// FORCE JOIN
// ============================================================

async function forceJoinStage() {

    console.log(
        `🎙️ [${GROUP_ID}] صعود إجباري...`
    );

    try {

        const slots =
            await getStageSlots();

        const freeSlot =
            slots.find(
                slot =>
                    !slot?.occupierId
            );

        if (!freeSlot) {

            console.log(
                "❌ لا يوجد Slot فارغ."
            );

            return;
        }

        await service.stage.slot.join(
            GROUP_ID,
            freeSlot.id
        );

        currentSlotId =
            freeSlot.id;

        autoCheckEnabled = false;

        stopMonitoring();

        console.log(
            `✅ تم الصعود إلى Slot ${currentSlotId}`
        );

    } catch (error) {

        console.error(
            "❌ Force Join:",
            error?.message ||
            error
        );
    }
}

// ============================================================
// LEAVE
// ============================================================

async function leaveStage() {

    if (!currentSlotId) {

        console.log(
            "ℹ️ البوت ليس على Stage."
        );

        return;
    }

    try {

        await service.stage.slot.leave(
            GROUP_ID,
            currentSlotId
        );

        console.log(
            "✅ تم النزول من Stage"
        );

    } catch (error) {

        console.error(
            "❌ Leave:",
            error?.message ||
            error
        );
    }

    currentSlotId = null;

    autoCheckEnabled = true;

    startMonitoring();
}

// ============================================================
// MONITORING
// ============================================================

function startMonitoring() {

    stopMonitoring();

    if (
        !autoCheckEnabled ||
        currentSlotId
    ) {
        return;
    }

    console.log(
        "🔄 مراقبة Stage كل 10 دقائق"
    );

    monitorTimer =
        setInterval(
            checkStage,
            CHECK_INTERVAL_MS
        );
}

function stopMonitoring() {

    if (monitorTimer) {

        clearInterval(
            monitorTimer
        );

        monitorTimer = null;
    }
}

// ============================================================
// SHUTDOWN
// ============================================================

async function shutdown(signal) {

    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    console.log(
        `🛑 إغلاق البوت: ${signal}`
    );

    stopMonitoring();

    try {

        if (
            currentSlotId &&
            service
        ) {

            await service.stage.slot.leave(
                GROUP_ID,
                currentSlotId
            );

            console.log(
                "✅ تم النزول من Stage"
            );
        }

    } catch {}

    try {

        socket?.disconnect();

    } catch {}

    process.exit(0);
}

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🐺 WOLF BOT"
    );

    console.log(
        "========================================"
    );

    console.log(
        "🐺 wolf.js 2.7.10"
    );

    console.log(
        `🏠 GROUP: ${GROUP_ID}`
    );

    console.log(
        "========================================"
    );

    verifyCredentials();

    // ========================================================
    // PUPPETEER
    // ========================================================

    console.log("");
    console.log(
        "🌐 تشغيل Chromium بواسطة Puppeteer..."
    );

    const browser =
        await puppeteer.launch({

            headless: true,

            defaultViewport: {
                width: WIDTH,
                height: HEIGHT,
                deviceScaleFactor: 1
            },

            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--window-size=600,600",
                "--lang=ar-SA"
            ]
        });

    console.log(
        "✅ Chromium جاهز"
    );

    try {

        // ====================================================
        // WOLF PAGE
        // ====================================================

        const page =
            await getWolfPage(
                browser
            );

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

        await preparePage(page);

        await printViewport(page);

        // ====================================================
        // LOGIN
        // ====================================================

        await performLogin(page);

        await checkAfterLogin(page);

        // ====================================================
        // CREDENTIALS
        // ====================================================

        const credentials =
            await readCredentials(page);

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "✅ WOLF LOGIN SUCCESS"
        );

        console.log(
            `🔐 v3APIToken: ${maskToken(credentials.token)}`
        );

        console.log(
            `🛡️ appCheckToken: ${maskToken(credentials.appCheckToken)}`
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

        // ====================================================
        // WOLF.JS
        // ====================================================

        createWolfService(
            credentials
        );

        await initializeWolfHandlers();

        setupPrivateCommandListener();

        // ====================================================
        // API
        // ====================================================

        await connectWolfSocket(
            credentials
        );

        // ====================================================
        // STAGE
        // ====================================================

        await verifyStageAPI();

        await checkStage();

        if (!currentSlotId) {
            startMonitoring();
        }

        console.log("");
        console.log(
            "========================================"
        );

        console.log(
            "🟢 البوت يعمل الآن"
        );

        console.log(
            `🏠 GROUP_ID: ${GROUP_ID}`
        );

        console.log(
            "👻 Online State: Invisible"
        );

        console.log(
            "⏱️ Stage Check: 10 minutes"
        );

        console.log(
            "========================================"
        );

        // لا نغلق Chromium؛ يبقى الـ process حيًا
        await new Promise(() => {});

    } finally {

        // لن يصل هنا أثناء التشغيل الطبيعي
        await browser.close();
    }
}

// ============================================================
// START
// ============================================================

main().catch(error => {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "❌ FATAL ERROR"
    );

    console.log(
        "========================================"
    );

    console.error(
        error?.stack ||
        error?.message ||
        error
    );

    console.log(
        "========================================"
    );

    try {
        socket?.disconnect();
    } catch {}

    process.exit(1);
});

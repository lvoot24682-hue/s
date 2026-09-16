import wolfjs from "wolf.js";
import { io } from "socket.io-client";
import { loadSession } from "./session-loader.js";

const { WOLF, OnlineState } = wolfjs;

// ============================================================
// إعدادات البوت
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

const CHECK_INTERVAL_MS =
    10 * 60 * 1000;

const MAX_OCCUPANTS_TO_JOIN = 1;

// ============================================================
// Variables
// ============================================================

let WOLF_TOKEN = null;
let WOLF_APP_CHECK_TOKEN = null;

let service = null;
let socket = null;

let monitorTimer = null;

let autoCheckEnabled = true;

let currentSlotId = null;

let shuttingDown = false;

// ============================================================
// Helpers
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

function maskToken(value) {

    if (!value) {
        return "غير موجود";
    }

    const text =
        String(value);

    if (text.length <= 16) {

        return (
            `${text.slice(0, 4)}...${text.slice(-4)}`
        );
    }

    return (
        `${text.slice(0, 8)}...${text.slice(-8)}`
    );
}

function isWatchedSubscriber(id) {

    return WATCHED_SUBSCRIBER_IDS.includes(
        Number(id)
    );
}

// ============================================================
// LOAD LOGIN
// ============================================================

async function loadWolfCredentials() {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "🔐 تسجيل الدخول إلى WOLF"
    );

    console.log(
        "========================================"
    );

    const session =
        await loadSession();

    if (!session) {

        throw new Error(
            "❌ لم يتم الحصول على جلسة WOLF."
        );
    }

    WOLF_TOKEN =
        session.token;

    WOLF_APP_CHECK_TOKEN =
        session.appCheckToken;

    if (!WOLF_TOKEN) {

        throw new Error(
            "❌ v3APIToken غير موجود."
        );
    }

    if (!WOLF_APP_CHECK_TOKEN) {

        throw new Error(
            "❌ appCheckToken غير موجود."
        );
    }

    console.log("");
    console.log(
        "✅ تم الحصول على WOLF credentials"
    );

    console.log(
        `🔐 v3APIToken: ${maskToken(WOLF_TOKEN)}`
    );

    console.log(
        `🛡️ appCheckToken: ${maskToken(WOLF_APP_CHECK_TOKEN)}`
    );

    console.log(
        "📱 Device: web"
    );

    console.log(
        "🛡️ App Check: true"
    );
}

// ============================================================
// CREATE SERVICE
// ============================================================

function createWolfService() {

    console.log("");
    console.log(
        "🐺 إنشاء wolf.js 2.7.10..."
    );

    service =
        new WOLF();

    // --------------------------------------------------------
    // Token
    // --------------------------------------------------------

    service.config.framework.login.token =
        WOLF_TOKEN;

    // --------------------------------------------------------
    // Online State
    // --------------------------------------------------------

    service.config.framework.login.onlineState =
        OnlineState.INVISIBLE;

    // --------------------------------------------------------
    // App Check
    // --------------------------------------------------------

    service.config.framework.login.appCheckToken =
        WOLF_APP_CHECK_TOKEN;

    console.log(
        "🔐 Token:",
        maskToken(WOLF_TOKEN)
    );

    console.log(
        "🛡️ App Check:",
        maskToken(WOLF_APP_CHECK_TOKEN)
    );

    console.log(
        "👻 Online State: Invisible"
    );

    console.log(
        "✅ WOLF service جاهز"
    );

    return service;
}

// ============================================================
// Initialize Handlers
// ============================================================

async function initializeWolfHandlers() {

    console.log("");
    console.log(
        "⚙️ [WOLF] تهيئة socket handlers..."
    );

    await service.websocket.init();

    const handlerCount =
        Object.keys(
            service.websocket.handlers || {}
        ).length;

    console.log(
        `⚙️ [WOLF] Loaded ${handlerCount} handlers`
    );
}

// ============================================================
// Private Messages
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
                    text ===
                    LEAVE_COMMAND
                ) {

                    await leaveStage();

                    return;
                }

                if (
                    text ===
                    JOIN_COMMAND
                ) {

                    await forceJoinStage();

                    return;
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
// Socket
// ============================================================

async function connectWolfSocket() {

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

    console.log(
        `🔐 Token: ${maskToken(WOLF_TOKEN)}`
    );

    console.log(
        `🛡️ AppCheck: ${maskToken(WOLF_APP_CHECK_TOKEN)}`
    );

    console.log(
        "========================================"
    );

    // --------------------------------------------------------
    // Socket.IO
    // --------------------------------------------------------

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
                        WOLF_TOKEN,

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
                        WOLF_APP_CHECK_TOKEN
                }
            }
        );

    // --------------------------------------------------------
    // Attach
    // --------------------------------------------------------

    service.websocket.socket =
        socket;

    // --------------------------------------------------------
    // Connect
    // --------------------------------------------------------

    socket.on(
        "connect",
        () => {

            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "🔗 [WOLF] Socket.IO connected"
            );

            console.log(
                `🔗 Socket ID: ${socket.id}`
            );

            console.log(
                "========================================"
            );
        }
    );

    // --------------------------------------------------------
    // Error
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Disconnect
    // --------------------------------------------------------

    socket.on(
        "disconnect",
        reason => {

            console.log(
                `🔌 [WOLF] disconnected: ${reason}`
            );
        }
    );

    // --------------------------------------------------------
    // WOLF Events
    // --------------------------------------------------------

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
// Authorization
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
// Stage API
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
// Get Slots
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
// Check Stage
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

        autoCheckEnabled =
            false;

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
// Force Join
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

        autoCheckEnabled =
            false;

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
// Leave
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

    currentSlotId =
        null;

    autoCheckEnabled =
        false;

    stopMonitoring();
}

// ============================================================
// Monitoring
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

        monitorTimer =
            null;
    }
}

// ============================================================
// Shutdown
// ============================================================

async function shutdown(
    signal
) {

    if (shuttingDown) {
        return;
    }

    shuttingDown =
        true;

    console.log("");
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
    () =>
        shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () =>
        shutdown("SIGTERM")
);

// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log("");
    console.log(
        "🐺 WOLF BOT STARTED"
    );

    console.log(
        "========================================"
    );

    console.log(
        "🐺 wolf.js 2.7.10"
    );

    console.log(
        "🏠 GROUP:",
        GROUP_ID
    );

    console.log(
        "========================================"
    );

    // --------------------------------------------------------
    // 1. Chrome Login
    // --------------------------------------------------------

    await loadWolfCredentials();

    // --------------------------------------------------------
    // 2. WOLF Service
    // --------------------------------------------------------

    createWolfService();

    // --------------------------------------------------------
    // 3. Handlers
    // --------------------------------------------------------

    await initializeWolfHandlers();

    // --------------------------------------------------------
    // 4. Private Commands
    // --------------------------------------------------------

    setupPrivateCommandListener();

    // --------------------------------------------------------
    // 5. API Connection
    // --------------------------------------------------------

    await connectWolfSocket();

    // --------------------------------------------------------
    // 6. Stage
    // --------------------------------------------------------

    await verifyStageAPI();

    // --------------------------------------------------------
    // 7. First Check
    // --------------------------------------------------------

    await checkStage();

    // --------------------------------------------------------
    // 8. Monitoring
    // --------------------------------------------------------

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
        "========================================");
}

// ============================================================
// Start
// ============================================================

main().catch(
    error => {

        console.error("");
        console.error(
            "========================================"
        );

        console.error(
            "❌ FATAL ERROR"
        );

        console.error(
            error?.stack ||
            error?.message ||
            error
        );

        console.error(
            "========================================"
        );

        try {
            socket?.disconnect();
        } catch {}

        process.exit(1);
    }
);

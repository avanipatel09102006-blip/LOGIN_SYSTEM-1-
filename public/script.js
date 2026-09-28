// ==================================================
// LOGIN SYSTEM - FRONTEND
// ==================================================

const authModal =
    document.getElementById("authModal");

const loginPanel =
    document.getElementById("loginPanel");

const registerPanel =
    document.getElementById("registerPanel");

const registerOtpPanel =
    document.getElementById("registerOtpPanel");

const forgotEmailPanel =
    document.getElementById("forgotEmailPanel");

const forgotOtpPanel =
    document.getElementById("forgotOtpPanel");

const resetPasswordPanel =
    document.getElementById("resetPasswordPanel");

const dashboard =
    document.getElementById("dashboard");

const toast =
    document.getElementById("toast");


let currentRegisterEmail = "";

let currentForgotEmail = "";

let currentResetToken = "";

let toastTimer = null;


// ==================================================
// TOAST
// ==================================================

function showToast(message, type = "normal") {

    clearTimeout(toastTimer);

    toast.textContent = message;

    toast.style.background =
        type === "error"
            ? "#b42318"
            : type === "success"
                ? "#18794e"
                : "#172033";

    toast.classList.add("show");

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}


// ==================================================
// MODAL
// ==================================================

function openLogin() {

    authModal.classList.add("show");

    showLogin();
}

function openRegister() {

    authModal.classList.add("show");

    showRegister();
}

function closeModal() {

    authModal.classList.remove("show");
}

function hideAllPanels() {

    [
        loginPanel,
        registerPanel,
        registerOtpPanel,
        forgotEmailPanel,
        forgotOtpPanel,
        resetPasswordPanel
    ].forEach(panel => {
        panel.classList.add("hidden");
    });
}


// ==================================================
// SHOW PANELS
// ==================================================

function showLogin() {

    hideAllPanels();

    loginPanel.classList.remove("hidden");

    renderGoogleButton();
}

function showRegister() {

    hideAllPanels();

    registerPanel.classList.remove("hidden");
}

function showRegisterOTP(email) {

    hideAllPanels();

    registerOtpPanel.classList.remove("hidden");

    document.getElementById(
        "registerOtpEmail"
    ).textContent = email;
}

function openForgot() {

    hideAllPanels();

    forgotEmailPanel.classList.remove("hidden");
}

function showForgotOTP() {

    hideAllPanels();

    forgotOtpPanel.classList.remove("hidden");
}

function showResetPassword() {

    hideAllPanels();

    resetPasswordPanel.classList.remove("hidden");
}


// ==================================================
// LOGIN
// ==================================================

document
    .getElementById("loginForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        const email =
            document
                .getElementById("loginEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("loginPassword")
                .value;

        if (!email || !password) {

            showToast(
                "Please enter email and password.",
                "error"
            );

            return;
        }

        try {

            const response =
                await fetch("/api/login", {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email,
                        password
                    })
                });

            const data =
                await response.json();

            if (!data.success) {

                showToast(
                    data.message,
                    "error"
                );

                return;
            }

            showToast(
                "Login successful!",
                "success"
            );

            saveLogin(data.user);

            setTimeout(() => {

                closeModal();

                showDashboard(
                    data.user
                );

            }, 500);

        } catch (error) {

            console.error(error);

            showToast(
                "Unable to connect to server.",
                "error"
            );
        }
    });


// ==================================================
// REGISTER
// ==================================================

document
    .getElementById("registerForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        const name =
            document
                .getElementById("registerName")
                .value
                .trim();

        const email =
            document
                .getElementById("registerEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("registerPassword")
                .value;

        const confirmPassword =
            document
                .getElementById("registerConfirmPassword")
                .value;

        if (!name || !email || !password || !confirmPassword) {

            showToast(
                "Please fill all fields.",
                "error"
            );

            return;
        }

        if (password.length < 6) {

            showToast(
                "Password must contain at least 6 characters.",
                "error"
            );

            return;
        }

        if (password !== confirmPassword) {

            showToast(
                "Passwords do not match.",
                "error"
            );

            return;
        }

        try {

            const response =
                await fetch("/api/register", {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        confirmPassword
                    })
                });

            const data =
                await response.json();

            if (!data.success) {

                showToast(
                    data.message,
                    "error"
                );

                return;
            }

            currentRegisterEmail =
                data.email;

            showRegisterOTP(
                data.email
            );

            showToast(
                "OTP sent to your email.",
                "success"
            );

        } catch (error) {

            console.error(error);

            showToast(
                "Unable to connect to server.",
                "error"
            );
        }
    });


// ==================================================
// VERIFY REGISTER OTP
// ==================================================

async function verifyRegistrationOTP() {

    const otp =
        document
            .getElementById("registerOtp")
            .value
            .trim();

    if (otp.length !== 6) {

        showToast(
            "Please enter the 6-digit OTP.",
            "error"
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/register/verify",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email:
                            currentRegisterEmail,
                        otp
                    })
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            showToast(
                data.message,
                "error"
            );

            return;
        }

        showToast(
            "Account created successfully!",
            "success"
        );

        setTimeout(() => {

            showLogin();

            document
                .getElementById("loginEmail")
                .value =
                currentRegisterEmail;

        }, 800);

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to verify OTP.",
            "error"
        );
    }
}


// ==================================================
// RESEND REGISTER OTP
// ==================================================

async function resendRegistrationOTP() {

    if (!currentRegisterEmail) {

        showToast(
            "Registration session not found.",
            "error"
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/register/resend-otp",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email:
                            currentRegisterEmail
                    })
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            showToast(
                data.message,
                "error"
            );

            return;
        }

        showToast(
            "New OTP sent successfully.",
            "success"
        );

    } catch (error) {

        showToast(
            "Unable to resend OTP.",
            "error"
        );
    }
}


// ==================================================
// FORGOT PASSWORD - SEND OTP
// ==================================================

async function sendForgotOTP() {

    const email =
        document
            .getElementById("forgotEmail")
            .value
            .trim();

    if (!email) {

        showToast(
            "Please enter your email.",
            "error"
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/forgot-password",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email
                    })
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            showToast(
                data.message,
                "error"
            );

            return;
        }

        currentForgotEmail =
            data.email;

        showForgotOTP();

        showToast(
            "Password reset OTP sent.",
            "success"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to send OTP.",
            "error"
        );
    }
}


// ==================================================
// VERIFY FORGOT OTP
// ==================================================

async function verifyForgotOTP() {

    const otp =
        document
            .getElementById("forgotOtp")
            .value
            .trim();

    if (otp.length !== 6) {

        showToast(
            "Please enter the 6-digit OTP.",
            "error"
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/forgot-password/verify",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email:
                            currentForgotEmail,
                        otp
                    })
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            showToast(
                data.message,
                "error"
            );

            return;
        }

        currentResetToken =
            data.resetToken;

        showResetPassword();

        showToast(
            "OTP verified successfully.",
            "success"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to verify OTP.",
            "error"
        );
    }
}


// ==================================================
// RESET PASSWORD
// ==================================================

async function resetPassword() {

    const password =
        document
            .getElementById("newPassword")
            .value;

    const confirmPassword =
        document
            .getElementById("confirmNewPassword")
            .value;

    if (!password || !confirmPassword) {

        showToast(
            "Please fill both password fields.",
            "error"
        );

        return;
    }

    if (password.length < 6) {

        showToast(
            "Password must contain at least 6 characters.",
            "error"
        );

        return;
    }

    if (password !== confirmPassword) {

        showToast(
            "Passwords do not match.",
            "error"
        );

        return;
    }

    try {

        const response =
            await fetch(
                "/api/reset-password",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        email:
                            currentForgotEmail,

                        resetToken:
                            currentResetToken,

                        password,

                        confirmPassword
                    })
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            showToast(
                data.message,
                "error"
            );

            return;
        }

        showToast(
            "Password changed successfully!",
            "success"
        );

        setTimeout(() => {

            showLogin();

        }, 800);

    } catch (error) {

        console.error(error);

        showToast(
            "Unable to change password.",
            "error"
        );
    }
}


// ==================================================
// GOOGLE LOGIN
// ==================================================

function renderGoogleButton() {

    const container =
        document.getElementById(
            "googleButton"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const clientId =
        window.GOOGLE_CLIENT_ID || "";

    if (!clientId) {

        container.innerHTML = `
            <button
                type="button"
                class="secondary-btn"
                style="width:100%; height:44px;"
                onclick="googleNotConfigured()">
                Continue with Google
            </button>
        `;

        return;
    }

    if (
        typeof google === "undefined" ||
        !google.accounts
    ) {

        setTimeout(
            renderGoogleButton,
            500
        );

        return;
    }

    google.accounts.id.initialize({

        client_id: clientId,

        callback:
            handleGoogleCredential

    });

    google.accounts.id.renderButton(
        container,
        {
            theme: "outline",
            size: "large",
            width: 370,
            text: "continue_with"
        }
    );
}

function googleNotConfigured() {

    showToast(
        "Google Login needs Google OAuth configuration.",
        "error"
    );
}

async function handleGoogleCredential(response) {

    try {

        const result =
            await fetch(
                "/api/google-login",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        credential:
                            response.credential
                    })
                }
            );

        const data =
            await result.json();

        if (!data.success) {

            showToast(
                data.message,
                "error"
            );

            return;
        }

        saveLogin(data.user);

        showToast(
            "Google Login successful!",
            "success"
        );

        setTimeout(() => {

            closeModal();

            showDashboard(
                data.user
            );

        }, 500);

    } catch (error) {

        console.error(error);

        showToast(
            "Google Login failed.",
            "error"
        );
    }
}


// ==================================================
// LOGIN STORAGE
// ==================================================

function saveLogin(user) {

    localStorage.setItem(
        "loginSystemUser",
        JSON.stringify(user)
    );
}

function getLoggedUser() {

    const data =
        localStorage.getItem(
            "loginSystemUser"
        );

    if (!data) {
        return null;
    }

    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

function logout() {

    localStorage.removeItem(
        "loginSystemUser"
    );

    dashboard.classList.add(
        "hidden"
    );

    document.body.style.overflow = "";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    showToast(
        "You have been logged out.",
        "success"
    );
}


// ==================================================
// DASHBOARD
// ==================================================

function showDashboard(user) {

    dashboard.classList.remove(
        "hidden"
    );

    document
        .getElementById("dashboardName")
        .textContent =
        user.name;

    document
        .getElementById("profileName")
        .textContent =
        user.name;

    document
        .getElementById("profileEmail")
        .textContent =
        user.email;

    dashboard.scrollIntoView({
        behavior: "smooth"
    });
}


// ==================================================
// INITIAL LOAD
// ==================================================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        const user =
            getLoggedUser();

        if (user) {
            showDashboard(user);
        }
    }
);


// ==================================================
// CLOSE MODAL ON OUTSIDE CLICK
// ==================================================

authModal.addEventListener(
    "click",
    function(event) {

        if (event.target === authModal) {
            closeModal();
        }
    }
);
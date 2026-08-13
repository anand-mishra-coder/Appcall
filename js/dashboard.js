/* =========================================================
   CallWeb — Dashboard Controller
   File: js/dashboard.js
   ========================================================= */
import "./webrtc.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   Configuration
   ========================================================= */

const LOGIN_PAGE = "index.html";


/* =========================================================
   DOM Elements
   ========================================================= */

const userList =
    document.getElementById("userList");

const searchInput =
    document.getElementById("searchInput");

const currentUserName =
    document.getElementById("currentUserName");

const currentUserEmail =
    document.getElementById("currentUserEmail");

const profileAvatar =
    document.getElementById("profileAvatar");

const logoutButton =
    document.getElementById("logoutButton");

const emptyState =
    document.getElementById("emptyState");

const loadingState =
    document.getElementById("loadingState");

const dashboardMessage =
    document.getElementById("dashboardMessage");


/* =========================================================
   State
   ========================================================= */

let currentUser = null;
let allUsers = [];
let unsubscribeUsers = null;


/* =========================================================
   Initials
   ========================================================= */

function getInitials(name = "") {

    const words =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    if (!words.length) {
        return "U";
    }

    if (words.length === 1) {

        return words[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


/* =========================================================
   Escape HTML
   ========================================================= */

function escapeHTML(value = "") {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   Loading
   ========================================================= */

function setLoading(show) {

    if (!loadingState) {
        return;
    }

    loadingState.style.display =
        show ? "flex" : "none";
}


/* =========================================================
   Dashboard Message
   ========================================================= */

function showMessage(
    message = "",
    type = ""
) {

    if (!dashboardMessage) {
        return;
    }

    dashboardMessage.textContent =
        message;

    dashboardMessage.className =
        type
            ? `dashboard-message ${type}`
            : "dashboard-message";
}


/* =========================================================
   Current User UI
   ========================================================= */

function renderCurrentUser(user) {

    if (!user) {
        return;
    }

    const name =
        user.displayName ||
        user.email?.split("@")[0] ||
        "User";

    const email =
        user.email ||
        "";


    if (currentUserName) {

        currentUserName.textContent =
            name;
    }


    if (currentUserEmail) {

        currentUserEmail.textContent =
            email;
    }


    if (profileAvatar) {

        profileAvatar.textContent =
            getInitials(name);
    }
}


/* =========================================================
   Create User Card
   ========================================================= */

function createUserCard(user) {

    const name =
        user.displayName ||
        user.name ||
        user.email?.split("@")[0] ||
        "CallWeb User";

    const email =
        user.email ||
        "";

    /*
     * Firestore document may use:
     *
     * uid
     * OR
     * document ID
     */

    const uid =
        user.uid ||
        user.id ||
        "";

    const photoURL =
        user.photoURL ||
        "";

    const initials =
        getInitials(name);


    const card =
        document.createElement("article");

    card.className =
        "user-card";

    card.dataset.uid =
        uid;

    card.dataset.name =
        name.toLowerCase();

    card.dataset.email =
        email.toLowerCase();


    /* =====================================================
       Avatar
    ===================================================== */

    const avatarHTML =
        photoURL

            ? `
                <img
                    src="${escapeHTML(photoURL)}"
                    alt="${escapeHTML(name)}"
                    class="user-avatar-image"
                >
              `

            : `
                <span class="user-avatar-initials">
                    ${escapeHTML(initials)}
                </span>
              `;


    /* =====================================================
       Card HTML
    ===================================================== */

    card.innerHTML = `

        <div class="user-info">

            <div class="user-avatar">

                ${avatarHTML}

                <span
                    class="online-indicator"
                    title="Available"
                ></span>

            </div>


            <div class="user-details">

                <h3>
                    ${escapeHTML(name)}
                </h3>

                <p>
                    ${escapeHTML(email)}
                </p>

            </div>

        </div>


        <div class="call-actions">


            <!-- =========================================
                 AUDIO CALL
            ========================================== -->

            <button
                type="button"
                class="call-button audio-call-button"
                data-call-type="audio"
                data-user-id="${escapeHTML(uid)}"
                data-user-name="${escapeHTML(name)}"
                aria-label="Audio call ${escapeHTML(name)}"
                title="Audio Call"
            >

                <i data-lucide="phone"></i>

            </button>


            <!-- =========================================
                 VIDEO CALL
            ========================================== -->

            <button
                type="button"
                class="call-button video-call-button"
                data-call-type="video"
                data-user-id="${escapeHTML(uid)}"
                data-user-name="${escapeHTML(name)}"
                aria-label="Video call ${escapeHTML(name)}"
                title="Video Call"
            >

                <i data-lucide="video"></i>

            </button>


        </div>

    `;


    return card;
}


/* =========================================================
   Render Users
   ========================================================= */

function renderUsers(users) {

    if (!userList) {
        return;
    }


    userList.innerHTML = "";


    const filteredUsers =
        users.filter(user => {

            const uid =
                user.uid ||
                user.id ||
                "";

            return (
                uid &&
                uid !== currentUser?.uid
            );
        });


    /* =====================================================
       Empty State
    ===================================================== */

    if (!filteredUsers.length) {

        if (emptyState) {

            emptyState.style.display =
                "flex";
        }

        return;
    }


    if (emptyState) {

        emptyState.style.display =
            "none";
    }


    const fragment =
        document.createDocumentFragment();


    filteredUsers.forEach(user => {

        fragment.appendChild(
            createUserCard(user)
        );

    });


    userList.appendChild(
        fragment
    );


    /* =====================================================
       Lucide
    ===================================================== */

    if (window.lucide) {

        window.lucide.createIcons();
    }
}


/* =========================================================
   Load Users
   ========================================================= */

function loadUsers() {

    if (!currentUser) {
        return;
    }


    setLoading(true);

    showMessage();


    /* =====================================================
       Remove Previous Listener
    ===================================================== */

    if (unsubscribeUsers) {

        unsubscribeUsers();

        unsubscribeUsers = null;
    }


    const usersRef =
        collection(
            db,
            "users"
        );


    /* =====================================================
       Firestore Listener
    ===================================================== */

    unsubscribeUsers =
        onSnapshot(

            usersRef,

            snapshot => {

                allUsers =
                    snapshot.docs.map(
                        document => ({

                            id:
                                document.id,

                            ...document.data()

                        })
                    );


                console.log(
                    "CallWeb Users:",
                    allUsers
                );


                renderUsers(
                    allUsers
                );


                setLoading(false);


                const otherUsers =
                    allUsers.filter(
                        user => {

                            const uid =
                                user.uid ||
                                user.id ||
                                "";

                            return (
                                uid &&
                                uid !==
                                currentUser.uid
                            );
                        }
                    );


                if (!otherUsers.length) {

                    showMessage(
                        "No other users found. Login with another account to make a call.",
                        "success"
                    );

                } else {

                    showMessage();
                }

            },

            error => {

                console.error(
                    "Firestore Users Error:",
                    error
                );


                setLoading(false);


                showMessage(
                    "Unable to load users. Check your Firestore Rules.",
                    "error"
                );
            }
        );
}


/* =========================================================
   Search Users
   ========================================================= */

function searchUsers(value) {

    const search =
        String(value)
            .trim()
            .toLowerCase();


    if (!search) {

        renderUsers(
            allUsers
        );

        return;
    }


    const filtered =
        allUsers.filter(user => {

            const name =
                (
                    user.displayName ||
                    user.name ||
                    ""
                )
                .toLowerCase();


            const email =
                (
                    user.email ||
                    ""
                )
                .toLowerCase();


            return (
                name.includes(search) ||
                email.includes(search)
            );
        });


    renderUsers(
        filtered
    );
}


/* =========================================================
   Search Listener
   ========================================================= */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        event => {

            searchUsers(
                event.target.value
            );
        }
    );
}


/* =========================================================
   START WEBRTC CALL
   ========================================================= */

async function startCall(
    receiverId,
    callType,
    receiverName
) {

    /* =====================================================
       Validate User
    ===================================================== */

    if (!currentUser) {

        showMessage(
            "Please login first.",
            "error"
        );

        return;
    }


    if (!receiverId) {

        showMessage(
            "Invalid receiver.",
            "error"
        );

        return;
    }


    if (
        receiverId ===
        currentUser.uid
    ) {

        showMessage(
            "You cannot call yourself.",
            "error"
        );

        return;
    }


    /* =====================================================
       Check WebRTC Engine
    ===================================================== */

    if (
        !window.CallWebRTC ||
        typeof window.CallWebRTC.startCall !==
        "function"
    ) {

        console.error(
            "CallWebRTC.startCall is not available."
        );


        showMessage(
            "Calling system is not ready. Please refresh the page.",
            "error"
        );

        return;
    }


    /* =====================================================
       UI
    ===================================================== */

    const buttons =
        document.querySelectorAll(
            ".call-button"
        );


    buttons.forEach(button => {

        button.disabled = true;

    });


    showMessage(
        callType === "video"
            ? "Opening video call..."
            : "Opening audio call...",
        "success"
    );


    try {

        console.log(
            "Starting WebRTC Call",
            {
                callerId:
                    currentUser.uid,

                receiverId:
                    receiverId,

                receiverName:
                    receiverName,

                callType:
                    callType
            }
        );


        /* =================================================
           REAL WEBRTC CALL
        ================================================= */

        await window.CallWebRTC.startCall(
            receiverId,
            callType,
            receiverName
        );


        /*
         * webrtc.js अब:
         *
         * 1. Camera/Microphone permission लेगा
         * 2. PeerConnection बनाएगा
         * 3. Firestore में call बनाएगा
         * 4. Offer बनाएगा
         * 5. सामने वाले user को signaling भेजेगा
         * 6. Calling screen दिखाएगा
         */


        showMessage();


    } catch (error) {

        console.error(
            "WebRTC Start Call Error:",
            error
        );


        showMessage(
            "Unable to start the call. Check microphone/camera permission.",
            "error"
        );

    } finally {

        buttons.forEach(button => {

            button.disabled = false;

        });
    }
}


/* =========================================================
   Call Button Events
   ========================================================= */

if (userList) {

    userList.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    ".call-button"
                );


            if (!button) {
                return;
            }


            const receiverId =
                button.dataset.userId;


            const callType =
                button.dataset.callType ||
                "audio";


            const receiverName =
                button.dataset.userName ||
                "CallWeb User";


            startCall(
                receiverId,
                callType,
                receiverName
            );
        }
    );
}


/* =========================================================
   Logout
   ========================================================= */

async function logout() {

    try {

        if (unsubscribeUsers) {

            unsubscribeUsers();

            unsubscribeUsers = null;
        }


        await signOut(
            auth
        );


        window.location.replace(
            LOGIN_PAGE
        );

    } catch (error) {

        console.error(
            "Logout Error:",
            error
        );


        showMessage(
            "Unable to logout. Please try again.",
            "error"
        );
    }
}


/* =========================================================
   Logout Listener
   ========================================================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        logout
    );
}


/* =========================================================
   Authentication State
   ========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            currentUser =
                null;

            window.location.replace(
                LOGIN_PAGE
            );

            return;
        }


        currentUser =
            user;


        console.log(
            "Logged in user:",
            {
                uid:
                    user.uid,

                email:
                    user.email,

                name:
                    user.displayName
            }
        );


        renderCurrentUser(
            user
        );


        loadUsers();

    }
);


/* =========================================================
   Page Cleanup
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (unsubscribeUsers) {

            unsubscribeUsers();

            unsubscribeUsers = null;
        }
    }
);

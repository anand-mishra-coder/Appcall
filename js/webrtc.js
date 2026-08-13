/* =========================================================
   CallWeb — WebRTC Calling Engine
   File: js/webrtc.js

   Works with:
   dashboard.html
   firebase.js
   Firebase Authentication
   Firebase Firestore
   ========================================================= */

import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    auth,
    db
} from "./firebase.js";


/* =========================================================
   WEBRTC CONFIGURATION
========================================================= */

const RTC_CONFIG = {

    iceServers: [

        {
            urls: "stun:stun.l.google.com:19302"
        },

        {
            urls: "stun:stun1.l.google.com:19302"
        },

        {
            urls: "stun:stun2.l.google.com:19302"
        },

        {
            urls: "stun:stun3.l.google.com:19302"
        }

    ]

};


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentUser = null;

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let currentCallId = null;

let currentCallType = null;

let currentCallerId = null;

let currentReceiverId = null;

let currentRemoteName = "User";

let callStartTime = null;

let pendingCandidates = [];

let unsubscribeCall = null;

let unsubscribeCandidates = null;

let unsubscribeIncomingCalls = null;

let isCleaningUp = false;


/* =========================================================
   DOM ELEMENTS
========================================================= */

const callModal =
    document.getElementById("callModal");

const incomingCallModal =
    document.getElementById("incomingCallModal");

const outgoingCallModal =
    document.getElementById("outgoingCallModal");

const activeCallModal =
    document.getElementById("activeCallModal");


/* -----------------------------
   Incoming
----------------------------- */

const incomingCallerName =
    document.getElementById(
        "incomingCallerName"
    );

const incomingCallerInitial =
    document.getElementById(
        "incomingCallerInitial"
    );


/* -----------------------------
   Outgoing
----------------------------- */

const outgoingCallerName =
    document.getElementById(
        "outgoingCallerName"
    );

const outgoingCallStatus =
    document.getElementById(
        "outgoingCallStatus"
    );


/* -----------------------------
   Status
----------------------------- */

const callStatus =
    document.getElementById(
        "callStatus"
    );

const activeCallStatus =
    document.getElementById(
        "activeCallStatus"
    );


/* -----------------------------
   Video / Audio
----------------------------- */

const remoteVideo =
    document.getElementById(
        "remoteVideo"
    );

const localVideo =
    document.getElementById(
        "localVideo"
    );

const localAudio =
    document.getElementById(
        "localAudio"
    );


/* -----------------------------
   Buttons
----------------------------- */

const acceptCallButton =
    document.getElementById(
        "acceptCallButton"
    );

const rejectCallButton =
    document.getElementById(
        "rejectCallButton"
    );

const cancelCallButton =
    document.getElementById(
        "cancelCallButton"
    );

const endCallButton =
    document.getElementById(
        "endCallButton"
    );

const muteButton =
    document.getElementById(
        "muteButton"
    );

const cameraButton =
    document.getElementById(
        "cameraButton"
    );


/* =========================================================
   UTILITY — INITIALS
========================================================= */

function getInitials(
    name = "User"
) {

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
   UTILITY — CALL STATUS
========================================================= */

function setCallStatus(
    message
) {

    if (callStatus) {

        callStatus.textContent =
            message;

    }


    if (activeCallStatus) {

        activeCallStatus.textContent =
            message;

    }

}


/* =========================================================
   UTILITY — ICON REFRESH
========================================================= */

function refreshIcons() {

    if (
        window.lucide &&
        typeof window.lucide.createIcons ===
        "function"
    ) {

        window.lucide.createIcons();

    }

}


/* =========================================================
   SHOW PARENT CALL SYSTEM
========================================================= */

function showCallSystem() {

    if (callModal) {

        callModal.hidden = false;

        callModal.style.display = "";

    }

}


/* =========================================================
   HIDE PARENT CALL SYSTEM
========================================================= */

function hideCallSystem() {

    if (callModal) {

        callModal.hidden = true;

        callModal.style.display = "none";

    }

}


/* =========================================================
   HIDE ALL CALL WINDOWS
========================================================= */

function hideAllCallModals() {

    if (incomingCallModal) {

        incomingCallModal.hidden =
            true;

    }


    if (outgoingCallModal) {

        outgoingCallModal.hidden =
            true;

    }


    if (activeCallModal) {

        activeCallModal.hidden =
            true;

    }

}


/* =========================================================
   SHOW INCOMING CALL
========================================================= */

function showIncomingCall(
    name,
    callType
) {

    showCallSystem();

    hideAllCallModals();


    const caller =
        name || "Unknown User";


    if (incomingCallerName) {

        incomingCallerName.textContent =
            caller;

    }


    if (incomingCallerInitial) {

        incomingCallerInitial.textContent =
            getInitials(caller);

    }


    if (callStatus) {

        callStatus.textContent =
            callType === "video"
                ? "Incoming video call"
                : "Incoming audio call";

    }


    if (incomingCallModal) {

        incomingCallModal.hidden =
            false;

    }


    refreshIcons();

}


/* =========================================================
   SHOW OUTGOING CALL
========================================================= */

function showOutgoingCall(
    name,
    callType
) {

    showCallSystem();

    hideAllCallModals();


    const receiver =
        name || "User";


    if (outgoingCallerName) {

        outgoingCallerName.textContent =
            receiver;

    }


    if (outgoingCallStatus) {

        outgoingCallStatus.textContent =
            callType === "video"
                ? "Calling with video..."
                : "Calling...";

    }


    if (callStatus) {

        callStatus.textContent =
            "Calling...";

    }


    if (outgoingCallModal) {

        outgoingCallModal.hidden =
            false;

    }


    refreshIcons();

}


/* =========================================================
   SHOW ACTIVE CALL
========================================================= */

function showActiveCall() {

    showCallSystem();

    hideAllCallModals();


    if (activeCallModal) {

        activeCallModal.hidden =
            false;

    }


    setCallStatus(
        "Connected"
    );


    refreshIcons();


    /*
     * Important:
     * Browser sometimes needs play()
     * after remote stream is attached.
     */

    if (remoteVideo) {

        remoteVideo.play()
            .catch(() => {});

    }


    if (localVideo) {

        localVideo.play()
            .catch(() => {});

    }


    if (localAudio) {

        localAudio.play()
            .catch(() => {});

    }

}


/* =========================================================
   SHOW ERROR
========================================================= */

function showCallError(
    message
) {

    console.error(
        "CallWeb:",
        message
    );


    setCallStatus(
        message
    );


    if (
        typeof window.showToast ===
        "function"
    ) {

        window.showToast(
            message,
            "error"
        );

    }

}


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(
    auth,
    user => {

        currentUser =
            user || null;


        if (!user) {

            cleanupCall(false);

            return;

        }


        console.log(
            "CallWeb authenticated:",
            user.uid
        );


        listenForIncomingCalls();

    }
);


/* =========================================================
   CREATE PEER CONNECTION
========================================================= */

function createPeerConnection() {

    if (peerConnection) {

        try {
            peerConnection.close();
        } catch (error) {}

    }


    peerConnection =
        new RTCPeerConnection(
            RTC_CONFIG
        );


    /* =====================================================
       REMOTE STREAM
    ===================================================== */

    remoteStream =
        new MediaStream();


    if (remoteVideo) {

        remoteVideo.srcObject =
            remoteStream;

    }


    if (localAudio) {

        localAudio.srcObject =
            remoteStream;

    }


    peerConnection.ontrack =
        event => {

            console.log(
                "Remote track received:",
                event.track.kind
            );


            /*
             * Prefer event.streams[0]
             */

            if (
                event.streams &&
                event.streams[0]
            ) {

                event.streams[0]
                    .getTracks()
                    .forEach(track => {

                        const alreadyExists =
                            remoteStream
                                .getTracks()
                                .some(
                                    existing =>
                                        existing.id ===
                                        track.id
                                );


                        if (!alreadyExists) {

                            remoteStream.addTrack(
                                track
                            );

                        }

                    });

            } else {

                remoteStream.addTrack(
                    event.track
                );

            }


            if (remoteVideo) {

                remoteVideo.srcObject =
                    remoteStream;

                remoteVideo.play()
                    .catch(() => {});

            }


            if (localAudio) {

                localAudio.srcObject =
                    remoteStream;

                localAudio.play()
                    .catch(() => {});

            }

        };


    /* =====================================================
       ICE CANDIDATES
    ===================================================== */

    peerConnection.onicecandidate =
        async event => {

            if (
                !event.candidate ||
                !currentCallId ||
                !currentUser
            ) {

                return;

            }


            try {

                const candidatesRef =
                    collection(
                        db,
                        "calls",
                        currentCallId,
                        "candidates"
                    );


                await addDoc(
                    candidatesRef,
                    {

                        candidate:
                            event.candidate.toJSON(),

                        senderId:
                            currentUser.uid,

                        createdAt:
                            serverTimestamp()

                    }
                );

            } catch (error) {

                console.error(
                    "ICE candidate error:",
                    error
                );

            }

        };


    /* =====================================================
       CONNECTION STATE
    ===================================================== */

    peerConnection.onconnectionstatechange =
        () => {

            if (!peerConnection) {
                return;
            }


            const state =
                peerConnection.connectionState;


            console.log(
                "WebRTC connection state:",
                state
            );


            switch (state) {

                case "new":

                    setCallStatus(
                        "Preparing call..."
                    );

                    break;


                case "connecting":

                    setCallStatus(
                        "Connecting..."
                    );

                    break;


                case "connected":

                    setCallStatus(
                        "Connected"
                    );

                    break;


                case "disconnected":

                    setCallStatus(
                        "Connection interrupted..."
                    );

                    break;


                case "failed":

                    setCallStatus(
                        "Connection failed"
                    );


                    /*
                     * Give WebRTC a moment before
                     * closing everything.
                     */

                    setTimeout(
                        () => {

                            if (
                                peerConnection &&
                                peerConnection.connectionState ===
                                "failed"
                            ) {

                                endCall(
                                    false
                                );

                            }

                        },
                        1000
                    );

                    break;


                case "closed":

                    break;

            }

        };


    /* =====================================================
       ICE CONNECTION STATE
    ===================================================== */

    peerConnection.oniceconnectionstatechange =
        () => {

            if (!peerConnection) {
                return;
            }


            console.log(
                "ICE state:",
                peerConnection.iceConnectionState
            );

        };


    return peerConnection;

}


/* =========================================================
   GET LOCAL MEDIA
========================================================= */

async function getLocalMedia(
    callType
) {

    /*
     * Stop old stream first.
     */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        localStream = null;

    }


    const isVideo =
        callType === "video";


    const constraints = {

        audio: {

            echoCancellation: true,

            noiseSuppression: true,

            autoGainControl: true

        },

        video: isVideo
            ? {

                facingMode:
                    "user",

                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                },

                frameRate: {
                    ideal: 30
                }

            }
            : false

    };


    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "getUserMedia is not supported."
            );

        }


        localStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );


        console.log(
            "Local media acquired:",
            localStream.getTracks()
        );


        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.playsInline =
                true;

            localVideo.autoplay =
                true;


            localVideo.play()
                .catch(() => {});

        }


        /*
         * Add tracks to PeerConnection.
         */

        if (!peerConnection) {

            throw new Error(
                "PeerConnection is not ready."
            );

        }


        localStream
            .getTracks()
            .forEach(
                track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }
            );


        return localStream;

    } catch (error) {

        console.error(
            "Media permission error:",
            error
        );


        let message =
            "Unable to access microphone or camera.";


        if (
            error.name ===
            "NotAllowedError"
        ) {

            message =
                "Microphone/camera permission was denied.";

        }


        if (
            error.name ===
            "NotFoundError"
        ) {

            message =
                "Required microphone or camera was not found.";

        }


        showCallError(
            message
        );


        throw error;

    }

}


/* =========================================================
   START OUTGOING CALL
========================================================= */

export async function startCall(
    receiverId,
    callType = "audio",
    receiverName = "User"
) {

    if (!currentUser) {

        showCallError(
            "Please login first."
        );

        return;

    }


    if (!receiverId) {

        showCallError(
            "Invalid receiver."
        );

        return;

    }


    if (
        receiverId ===
        currentUser.uid
    ) {

        showCallError(
            "You cannot call yourself."
        );

        return;

    }


    /*
     * Prevent duplicate call.
     */

    if (currentCallId) {

        showCallError(
            "You already have an active call."
        );

        return;

    }


    if (
        callType !== "audio" &&
        callType !== "video"
    ) {

        callType =
            "audio";

    }


    try {

        isCleaningUp = false;


        currentCallType =
            callType;

        currentReceiverId =
            receiverId;

        currentCallerId =
            currentUser.uid;

        currentRemoteName =
            receiverName || "User";


        /*
         * Show calling screen immediately.
         */

        showOutgoingCall(
            currentRemoteName,
            callType
        );


        /*
         * Create WebRTC connection.
         */

        createPeerConnection();


        /*
         * Get microphone/camera.
         */

        await getLocalMedia(
            callType
        );


        /*
         * Create Firestore call.
         */

        const callsRef =
            collection(
                db,
                "calls"
            );


        const callDocument =
            await addDoc(
                callsRef,
                {

                    callerId:
                        currentUser.uid,

                    receiverId:
                        receiverId,

                    callerName:
                        currentUser.displayName ||
                        currentUser.email?.split("@")[0] ||
                        "User",

                    callerEmail:
                        currentUser.email ||
                        "",

                    receiverName:
                        receiverName ||
                        "User",

                    callType:
                        callType,

                    status:
                        "ringing",

                    createdAt:
                        serverTimestamp()

                }
            );


        currentCallId =
            callDocument.id;


        console.log(
            "Call created:",
            currentCallId
        );


        /*
         * Create offer.
         */

        const offer =
            await peerConnection
                .createOffer();


        await peerConnection
            .setLocalDescription(
                offer
            );


        /*
         * Save offer.
         */

        await updateDoc(
            doc(
                db,
                "calls",
                currentCallId
            ),
            {

                offer: {

                    type:
                        offer.type,

                    sdp:
                        offer.sdp

                }

            }
        );


        /*
         * Listen for answer.
         */

        listenForAnswer();


        /*
         * Listen for receiver ICE.
         */

        listenForIceCandidates(
            currentCallId,
            receiverId
        );


        /*
         * Start duration timer.
         * Real duration starts after connection.
         */

        console.log(
            "Waiting for answer..."
        );


    } catch (error) {

        console.error(
            "Start call error:",
            error
        );


        await cleanupCall(
            true
        );


        showCallError(
            "Unable to start the call."
        );

    }

}


/* =========================================================
   LISTEN FOR ANSWER
========================================================= */

function listenForAnswer() {

    if (!currentCallId) {
        return;
    }


    const callRef =
        doc(
            db,
            "calls",
            currentCallId
        );


    if (unsubscribeCall) {

        unsubscribeCall();

        unsubscribeCall =
            null;

    }


    unsubscribeCall =
        onSnapshot(
            callRef,
            async snapshot => {

                if (!snapshot.exists()) {

                    return;

                }


                const data =
                    snapshot.data();


                /*
                 * Receiver accepted.
                 */

                if (
                    data.answer &&
                    peerConnection &&
                    !peerConnection
                        .currentRemoteDescription
                ) {

                    try {

                        await peerConnection
                            .setRemoteDescription(
                                new RTCSessionDescription(
                                    data.answer
                                )
                            );


                        await applyPendingCandidates();


                        callStartTime =
                            Date.now();


                        showActiveCall();


                    } catch (error) {

                        console.error(
                            "Set remote answer error:",
                            error
                        );

                    }

                }


                /*
                 * Receiver rejected.
                 */

                if (
                    data.status ===
                    "rejected"
                ) {

                    showCallError(
                        "Call declined."
                    );


                    await cleanupCall(
                        false
                    );

                }


                /*
                 * Receiver ended.
                 */

                if (
                    data.status ===
                    "ended"
                ) {

                    await cleanupCall(
                        false
                    );

                }

            },

            error => {

                console.error(
                    "Answer listener error:",
                    error
                );

            }

        );

}


/* =========================================================
   LISTEN FOR INCOMING CALLS
========================================================= */

function listenForIncomingCalls() {

    if (!currentUser) {
        return;
    }


    /*
     * Remove old listener.
     */

    if (unsubscribeIncomingCalls) {

        unsubscribeIncomingCalls();

        unsubscribeIncomingCalls =
            null;

    }


    const callsRef =
        collection(
            db,
            "calls"
        );


    unsubscribeIncomingCalls =
        onSnapshot(
            callsRef,
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        change => {

                            if (
                                change.type !==
                                "added"
                            ) {

                                return;

                            }


                            const call =
                                change.doc.data();


                            /*
                             * Only calls for
                             * current user.
                             */

                            if (
                                call.receiverId !==
                                currentUser.uid
                            ) {

                                return;

                            }


                            /*
                             * Only ringing calls.
                             */

                            if (
                                call.status !==
                                "ringing"
                            ) {

                                return;

                            }


                            /*
                             * Ignore our own
                             * active call.
                             */

                            if (
                                currentCallId
                            ) {

                                return;

                            }


                            currentCallId =
                                change.doc.id;

                            currentCallerId =
                                call.callerId;

                            currentReceiverId =
                                call.receiverId;

                            currentCallType =
                                call.callType ||
                                "audio";

                            currentRemoteName =
                                call.callerName ||
                                "Unknown User";


                            console.log(
                                "Incoming call:",
                                call
                            );


                            showIncomingCall(
                                currentRemoteName,
                                currentCallType
                            );


                            /*
                             * Listen for caller ICE.
                             */

                            listenForIceCandidates(
                                currentCallId,
                                currentCallerId
                            );

                        }

                    );

            },

            error => {

                console.error(
                    "Incoming call listener error:",
                    error
                );

            }

        );

}


/* =========================================================
   ACCEPT INCOMING CALL
========================================================= */

export async function acceptCall() {

    if (!currentCallId) {

        showCallError(
            "No incoming call found."
        );

        return;

    }


    if (!currentUser) {

        showCallError(
            "Please login first."
        );

        return;

    }


    try {

        const callId =
            currentCallId;


        const callRef =
            doc(
                db,
                "calls",
                callId
            );


        const snapshot =
            await getDoc(
                callRef
            );


        if (!snapshot.exists()) {

            showCallError(
                "This call is no longer available."
            );


            await cleanupCall(
                false
            );


            return;

        }


        const call =
            snapshot.data();


        if (
            call.status !==
            "ringing"
        ) {

            showCallError(
                "This call is no longer ringing."
            );


            await cleanupCall(
                false
            );


            return;

        }


        currentCallerId =
            call.callerId;

        currentReceiverId =
            call.receiverId;

        currentCallType =
            call.callType ||
            "audio";

        currentRemoteName =
            call.callerName ||
            "User";


        /*
         * Create peer.
         */

        createPeerConnection();


        /*
         * Get local microphone/camera.
         */

        await getLocalMedia(
            currentCallType
        );


        /*
         * Set remote offer.
         */

        if (!call.offer) {

            throw new Error(
                "Caller offer not found."
            );

        }


        await peerConnection
            .setRemoteDescription(
                new RTCSessionDescription(
                    call.offer
                )
            );


        /*
         * Apply any ICE candidates
         * received before peer was ready.
         */

        await applyPendingCandidates();


        /*
         * Create answer.
         */

        const answer =
            await peerConnection
                .createAnswer();


        await peerConnection
            .setLocalDescription(
                answer
            );


        /*
         * Save answer and accepted status.
         */

        await updateDoc(
            callRef,
            {

                answer: {

                    type:
                        answer.type,

                    sdp:
                        answer.sdp

                },

                status:
                    "accepted",

                acceptedAt:
                    serverTimestamp()

            }
        );


        /*
         * Start call duration.
         */

        callStartTime =
            Date.now();


        /*
         * Show active UI.
         */

        showActiveCall();


        /*
         * Listen for caller ending call.
         */

        listenForCallStatus();


    } catch (error) {

        console.error(
            "Accept call error:",
            error
        );


        showCallError(
            "Unable to accept the call."
        );

    }

}


/* =========================================================
   REJECT INCOMING CALL
========================================================= */

export async function rejectCall() {

    if (!currentCallId) {

        return;

    }


    const callId =
        currentCallId;


    try {

        await updateDoc(
            doc(
                db,
                "calls",
                callId
            ),
            {

                status:
                    "rejected",

                endedBy:
                    currentUser?.uid ||
                    null,

                endedAt:
                    serverTimestamp()

            }
        );


    } catch (error) {

        console.error(
            "Reject call error:",
            error
        );

    } finally {

        await cleanupCall(
            false
        );

    }

}


/* =========================================================
   LISTEN FOR CALL STATUS
========================================================= */

function listenForCallStatus() {

    if (!currentCallId) {
        return;
    }


    const callRef =
        doc(
            db,
            "calls",
            currentCallId
        );


    if (unsubscribeCall) {

        unsubscribeCall();

        unsubscribeCall =
            null;

    }


    unsubscribeCall =
        onSnapshot(
            callRef,
            async snapshot => {

                if (!snapshot.exists()) {

                    await cleanupCall(
                        false
                    );

                    return;

                }


                const data =
                    snapshot.data();


                if (
                    data.status ===
                    "ended"
                ) {

                    await cleanupCall(
                        false
                    );

                }


                if (
                    data.status ===
                    "rejected"
                ) {

                    await cleanupCall(
                        false
                    );

                }

            },

            error => {

                console.error(
                    "Call status listener error:",
                    error
                );

            }

        );

}


/* =========================================================
   ICE CANDIDATE LISTENER
========================================================= */

function listenForIceCandidates(
    callId,
    remoteUserId
) {

    if (!callId) {
        return;
    }


    const candidatesRef =
        collection(
            db,
            "calls",
            callId,
            "candidates"
        );


    /*
     * Remove previous candidate listener.
     */

    if (unsubscribeCandidates) {

        unsubscribeCandidates();

        unsubscribeCandidates =
            null;

    }


    unsubscribeCandidates =
        onSnapshot(
            candidatesRef,
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        async change => {

                            if (
                                change.type !==
                                "added"
                            ) {

                                return;

                            }


                            const data =
                                change.doc.data();


                            /*
                             * Ignore our own
                             * candidates.
                             */

                            if (
                                data.senderId ===
                                currentUser?.uid
                            ) {

                                return;

                            }


                            if (
                                remoteUserId &&
                                data.senderId !==
                                remoteUserId
                            ) {

                                return;

                            }


                            const candidate =
                                data.candidate;


                            if (!candidate) {
                                return;
                            }


                            /*
                             * If peer is not ready,
                             * save candidate.
                             */

                            if (
                                !peerConnection ||
                                !peerConnection
                                    .remoteDescription
                            ) {

                                pendingCandidates
                                    .push(
                                        candidate
                                    );

                                return;

                            }


                            try {

                                await peerConnection
                                    .addIceCandidate(
                                        new RTCIceCandidate(
                                            candidate
                                        )
                                    );


                            } catch (error) {

                                console.error(
                                    "Add ICE candidate error:",
                                    error
                                );

                            }

                        }

                    );

            },

            error => {

                console.error(
                    "ICE listener error:",
                    error
                );

            }

        );

}


/* =========================================================
   APPLY PENDING ICE
========================================================= */

async function applyPendingCandidates() {

    if (
        !peerConnection ||
        !peerConnection.remoteDescription
    ) {

        return;

    }


    const candidates =
        [...pendingCandidates];


    pendingCandidates =
        [];


    for (
        const candidate
        of candidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

        } catch (error) {

            console.error(
                "Pending ICE error:",
                error
            );

        }

    }

}


/* =========================================================
   END CALL
========================================================= */

export async function endCall(
    saveHistory = true
) {

    if (isCleaningUp) {
        return;
    }


    const callId =
        currentCallId;


    const callerId =
        currentCallerId;


    const receiverId =
        currentReceiverId;


    const callType =
        currentCallType;


    const duration =
        callStartTime
            ? Math.max(
                0,
                Math.floor(
                    (
                        Date.now() -
                        callStartTime
                    ) / 1000
                )
            )
            : 0;


    try {

        if (
            callId &&
            currentUser
        ) {

            await updateDoc(
                doc(
                    db,
                    "calls",
                    callId
                ),
                {

                    status:
                        "ended",

                    duration:
                        duration,

                    endedBy:
                        currentUser.uid,

                    endedAt:
                        serverTimestamp()

                }
            );


            if (
                saveHistory &&
                duration >= 0
            ) {

                await saveCallHistory(
                    callerId,
                    receiverId,
                    callType,
                    duration
                );

            }

        }

    } catch (error) {

        console.error(
            "End call error:",
            error
        );

    } finally {

        await cleanupCall(
            false
        );

    }

}


/* =========================================================
   SAVE CALL HISTORY
========================================================= */

async function saveCallHistory(
    callerId,
    receiverId,
    callType,
    duration
) {

    if (!currentUser) {
        return;
    }


    try {

        await addDoc(
            collection(
                db,
                "callHistory"
            ),
            {

                callerId:
                    callerId ||
                    "",

                receiverId:
                    receiverId ||
                    "",

                callType:
                    callType ||
                    "audio",

                duration:
                    duration || 0,

                status:
                    "completed",

                createdAt:
                    serverTimestamp()

            }
        );


    } catch (error) {

        console.error(
            "Call history error:",
            error
        );

    }

}


/* =========================================================
   MUTE / UNMUTE
========================================================= */

export function toggleMute() {

    if (!localStream) {
        return;
    }


    const audioTracks =
        localStream.getAudioTracks();


    if (!audioTracks.length) {
        return;
    }


    const currentlyEnabled =
        audioTracks[0].enabled;


    audioTracks.forEach(
        track => {

            track.enabled =
                !currentlyEnabled;

        }
    );


    const muted =
        currentlyEnabled;


    if (muteButton) {

        muteButton.classList.toggle(
            "muted",
            muted
        );


        muteButton.setAttribute(
            "aria-label",
            muted
                ? "Unmute microphone"
                : "Mute microphone"
        );


        muteButton.setAttribute(
            "title",
            muted
                ? "Unmute"
                : "Mute"
        );


        const icon =
            muteButton.querySelector(
                "[data-lucide]"
            );


        if (icon) {

            icon.setAttribute(
                "data-lucide",
                muted
                    ? "mic-off"
                    : "mic"
            );

        }

    }


    refreshIcons();

}


/* =========================================================
   CAMERA ON / OFF
========================================================= */

export function toggleCamera() {

    if (!localStream) {
        return;
    }


    const videoTracks =
        localStream.getVideoTracks();


    if (!videoTracks.length) {

        return;

    }


    const currentlyEnabled =
        videoTracks[0].enabled;


    videoTracks.forEach(
        track => {

            track.enabled =
                !currentlyEnabled;

        }
    );


    const cameraOff =
        currentlyEnabled;


    if (cameraButton) {

        cameraButton.classList.toggle(
            "camera-off",
            cameraOff
        );


        cameraButton.setAttribute(
            "aria-label",
            cameraOff
                ? "Turn camera on"
                : "Turn camera off"
        );


        cameraButton.setAttribute(
            "title",
            cameraOff
                ? "Camera On"
                : "Camera Off"
        );


        const icon =
            cameraButton.querySelector(
                "[data-lucide]"
            );


        if (icon) {

            icon.setAttribute(
                "data-lucide",
                cameraOff
                    ? "video-off"
                    : "video"
            );

        }

    }


    refreshIcons();

}


/* =========================================================
   CLEANUP CALL
========================================================= */

async function cleanupCall(
    hideUI = true
) {

    if (isCleaningUp) {
        return;
    }


    isCleaningUp = true;


    try {

        /*
         * Stop local media.
         */

        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track => {

                        try {
                            track.stop();
                        } catch (error) {}

                    }
                );

            localStream =
                null;

        }


        /*
         * Close PeerConnection.
         */

        if (peerConnection) {

            try {

                peerConnection.ontrack =
                    null;

                peerConnection.onicecandidate =
                    null;

                peerConnection.onconnectionstatechange =
                    null;

                peerConnection.oniceconnectionstatechange =
                    null;

                peerConnection.close();

            } catch (error) {}

            peerConnection =
                null;

        }


        /*
         * Unsubscribe call listener.
         */

        if (unsubscribeCall) {

            try {
                unsubscribeCall();
            } catch (error) {}

            unsubscribeCall =
                null;

        }


        /*
         * Unsubscribe ICE listener.
         */

        if (unsubscribeCandidates) {

            try {
                unsubscribeCandidates();
            } catch (error) {}

            unsubscribeCandidates =
                null;

        }


        /*
         * Clear media elements.
         */

        if (localVideo) {

            localVideo.srcObject =
                null;

        }


        if (remoteVideo) {

            remoteVideo.srcObject =
                null;

        }


        if (localAudio) {

            localAudio.srcObject =
                null;

        }


        /*
         * Reset state.
         */

        currentCallId =
            null;

        currentCallType =
            null;

        currentCallerId =
            null;

        currentReceiverId =
            null;

        currentRemoteName =
            "User";

        callStartTime =
            null;

        pendingCandidates =
            [];


        /*
         * Hide UI.
         */

        if (hideUI) {

            hideAllCallModals();

            hideCallSystem();

        }


    } finally {

        isCleaningUp =
            false;

    }

}


/* =========================================================
   ACCEPT BUTTON
========================================================= */

if (acceptCallButton) {

    acceptCallButton.addEventListener(
        "click",
        async () => {

            await acceptCall();

        }
    );

}


/* =========================================================
   REJECT BUTTON
========================================================= */

if (rejectCallButton) {

    rejectCallButton.addEventListener(
        "click",
        async () => {

            await rejectCall();

        }
    );

}


/* =========================================================
   CANCEL OUTGOING CALL
========================================================= */

if (cancelCallButton) {

    cancelCallButton.addEventListener(
        "click",
        async () => {

            await endCall(
                false
            );

        }
    );

}


/* =========================================================
   END ACTIVE CALL
========================================================= */

if (endCallButton) {

    endCallButton.addEventListener(
        "click",
        async () => {

            await endCall(
                true
            );

        }
    );

}


/* =========================================================
   MUTE BUTTON
========================================================= */

if (muteButton) {

    muteButton.addEventListener(
        "click",
        () => {

            toggleMute();

        }
    );

}


/* =========================================================
   CAMERA BUTTON
========================================================= */

if (cameraButton) {

    cameraButton.addEventListener(
        "click",
        () => {

            toggleCamera();

        }
    );

}


/* =========================================================
   GLOBAL CALLWEB API
========================================================= */

window.CallWebRTC = {

    startCall,

    acceptCall,

    rejectCall,

    endCall,

    toggleMute,

    toggleCamera

};


/* =========================================================
   CONNECT DASHBOARD CALL BUTTONS
========================================================= */

document.addEventListener(
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


        /*
         * Get receiver name from
         * the user card.
         */

        const card =
            button.closest(
                ".user-card"
            );


        let receiverName =
            "User";


        if (card) {

            const nameElement =
                card.querySelector(
                    ".user-details h3"
                );


            if (nameElement) {

                receiverName =
                    nameElement
                        .textContent
                        .trim();

            }

        }


        startCall(
            receiverId,
            callType,
            receiverName
        );

    }
);


/* =========================================================
   INITIAL UI
========================================================= */

hideAllCallModals();

hideCallSystem();

refreshIcons();


console.log(
    "CallWeb WebRTC Engine loaded."
);

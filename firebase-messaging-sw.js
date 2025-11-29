importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCNjGhWVguIWBAHyyLfTapsF_5Bp6ztRG0",
    authDomain: "safewayos2.firebaseapp.com",
    projectId: "safewayos2",
    storageBucket: "safewayos2.appspot.com",
    messagingSenderId: "216681158749",
    appId: "1:216681158749:web:35de32f542ad71fa7295b4"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Do NOT call showNotification() here.
// The 'notification' payload from your Cloud Function is auto-displayed by the OS.

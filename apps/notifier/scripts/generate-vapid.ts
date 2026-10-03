import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("CF_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("CF_VAPID_PRIVATE_KEY=" + keys.privateKey);

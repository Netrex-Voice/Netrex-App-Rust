# Release Notes - v8.1.1

## 🎤 Mic Guard ("Your voice is not reaching others" warning)
- **Muted-speech detection fixed**: The warning never fired while muted. With the voice processor attached, LiveKit exposed the *processed* track, which goes silent on mute, so nothing was ever detected. Mic Guard now opens its own raw microphone stream (using the selected input device) and analyzes it locally, independent of mute state and the voice processor.
- **Privacy & resource friendly**: The stream is opened only while the mic is off, someone is in the room, and the configured delay has passed. Audio is analyzed locally and is never sent or recorded.
- **Resilient**: Permission/busy-device failures are retried quietly with back-off; an unplugged device is detected and the stream is re-opened.
- **Shorter spoken warning**: When the mic is muted, the TTS now simply says "Mikrofonunuz kapalı. Sesiniz gitmiyor."

## 🧑‍🤝‍🧑 Voice Room Fixes
- **"Connecting" badge no longer lingers**: Users could be heard while their card still showed "Bağlanıyor". The flag is now cleared as soon as the raw microphone is published (instead of waiting up to 5 s for the voice processor), and the badge is hidden whenever the participant's microphone track is already live.
- **Users no longer disappear from the left room list**: Room presence was written once on join and removed server-side if the Firebase Realtime Database connection blipped, while the voice connection stayed up. Presence (and its disconnect hook) is now restored automatically when the database connection returns.
- **Presence listener cleanup**: Room list presence listeners were not actually being detached on cleanup; fixed.

## 📺 Screen Share
- **Accurate viewer count**: The viewer counter compared against the wrong identifier format (`identity:screen`) and only looked at a single stream, so it rarely matched. It now reads the full list of watched streams and counts viewers correctly.

## 🖱️ Pointer Sharing
- **"Remove" works on the first click**: The desktop overlay rebuilt its lists ~30 times per second while cursors moved, destroying the button between mouse-down and mouse-up so clicks were lost (users had to spam the button). Lists are now re-rendered only when their content changes.

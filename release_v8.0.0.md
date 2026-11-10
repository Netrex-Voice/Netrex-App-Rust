# Release Notes - v8.0.0

## 🎬 Watch Party Experience 2.0 (Enhanced)
- **Persistent Media Rendering**: Refactored the core player to keep YouTube, SoundCloud, and generic players persistently in the DOM. This ensures playback is **never interrupted** when toggling the UI, switching between panels, or moving the player.
- **Horizontal Panel Layout**: Side-panels (Playlist & Settings) now open to the **left** of the player card instead of expanding downwards. This provides a more ergonomic desktop experience and prevents the UI from obscuring lower elements.
- **Improved Visual Clarity**: Increased the opacity of the player and panels to **95%** using a premium Zinc-900 background and enhanced backdrop-blur for maximum legibility and a premium feel.
- **Precision Seeking Fix**: Implemented a "Seek Cooldown" mechanism to prevent the progress bar from jittering or "jumping back" while the media is buffering a new position.
- **UI Clipping & Popover Fix**: Removed root container restrictions (`overflow-hidden`) to allow volume and settings popovers to overflow naturally, resolving the previous "cut-off" visual bug.
- **Compact Panel Sizing**: Optimized the height of the playlist and settings drawers to a balanced `370px` for a cleaner, non-intrusive desktop layout.
- **Advanced Player Logic**: Completely refactored the auto-advance and track voting mechanism. Implemented a tie-breaker system to ensure stable playlist ordering when tracks have equal votes.
- **On-Screen Display (OSD)**: Added a premium, YouTube-style overlay that provides visual feedback for all playback actions (Play/Pause, Seeking, Volume changes).
- **Master Volume Limiter**: Hardcoded a 50% global volume multiplier for Watch Party media to normalize high-gain studio tracks against user voice levels.
- **Smart Input Clearing**: The playlist input now automatically clears when a duplicate link error occurs, allowing for a faster workflow.
- **Windowed Player Interaction**:
  - **Custom Desktop Title Bar**: Introduced a native-feeling window header with "Minimize", "Maximize/Fullscreen", and "Close" controls.
  - **Drag & Drop Support**: The player can now be freely repositioned across the workspace using the title bar. 
  - **Safe Drag Constraints**: Implemented viewport boundaries to prevent the player from being dragged off-screen.
  - **Close Confirmation Modal**: A safe, modern modal replaces generic browser alerts when closing or leaving a session.

## ⌨️ Pro-User Shortcuts & Interactions
- **Precision Keyboard Controls**:
  - **Space**: Instant Play/Pause (synchronized for everyone).
  - **Left/Right Arrows**: Hassle-free 5-second seeking.
  - **Up/Down Arrows**: Ultra-smooth volume adjustment (1% increments).
- **Intuitive Mouse Actions**:
  - **Single Click**: Toggle playback status quickly.
  - **Double Click**: Seamlessly enter/exit Fullscreen mode.
- **Media Controls Overhaul**: Dedicated "Skip Next" and "Skip Previous" buttons now follow the **vote-sorted** playlist order, ensuring predictable navigation.
- **Context-Aware Logic**: Keybinds are intelligently disabled when typing in chat or input fields to prevent accidental playback triggers.

## ⚡ Performance & Polish
- **Dynamic Glassmorphism**: Playlist and Settings panels now feature a "Dynamic Tint" effect, mirroring the color palette and blurry thumbnail of the currently playing track.
- **Instant Navigation**: Removed redundant chat/welcome screen animations that caused perceived "double loading" or flicker when switching channels.
- **UI Stability**: Locked the heights of the Playlist and Settings panels to eliminate layout shifts during toggles.
- **Duplicate Protection**: Strict link validation to prevent the same piece of media from being added multiple times.
- **Refined Default Levels**: Adjusted default Watch Party volume from 80% to 15% for a much smoother initial experience.

## 🔊 Audio Engine & Performance Fixes
- **Audio Context Memory Management**: Fixed a major memory leak in `useVoiceProcessor.js` by ensuring the global shared AudioContext is properly nullified during cleanup.
- **Microphone Mute Optimization**: Split the voice processor's re-initialization logic to prevent full-graph reconstruction during mute/unmute. This eliminates CPU spikes and audio stuttering when toggling the microphone.
- **Intelligent Participant Volume Caching**: Implemented a caching layer for remote participant volumes, reducing redundant LiveKit API calls and lowering CPU usage during conversation.
- **Sound Initialization Queue**: Added a pending queue for system sounds triggered during application startup. Sounds are now buffered and played smoothly through the AudioContext once the engine is ready, preventing "double-loading" artifacts.

## 🛠️ LiveKit & Core Stability
- **LiveKit Server Fallback (v2.0)**: Fixed a critical loop where the system would repeatedly rotate through full servers. Added logic to ignore local Firebase writes and a "stale value" protection to ensure smooth automatic server switching.
- **Profile Picture Fallback Sync**: Resolved an issue where removing a Cloudinary profile picture would result in a default avatar instead of falling back to the user's original Google account photo.
- **Mute/Deafen Sync (Pending State)**: Implemented a robust "Pending State" mechanism for microphone and headphone toggles. This prevents race conditions where rapid clicking could cause the UI to show "unmuted" while the audio remained silent (or vice versa).
- **Screen Share CPU Leak Fix**: Patched a memory and processor leak where the `MediaStreamTrack` would continue capturing video even after closing the share. Added explicit track termination logic to ensure 0% CPU usage when sharing stops.
- **React Hook Safety**: Fixed a "Rendered fewer hooks than expected" crash that occurred when navigating back to the home screen while in a voice room. Moved conditional settings hooks to top-level to comply with React's strict rendering rules.


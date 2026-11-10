# Release Notes - v7.3.0

## 🚀 New Features: Watch Party
- **Synchronized Playback**: Introduced a robust Watch Party system allowing users to watch videos and listen to music together in perfect sync.
- **Smart Synchronization**: Implemented `useWatchPartySync` and `useWatchPartyDrift` to handle network latency and ensure everyone is at the same second of the media.
- **Real-time Integration**: Powered by Firebase for instant updates across all participants.
- **Interactive Playlist**: Added a collaborative playlist system where users can vote on the next track and manage the queue.
- **Interactive Controls**: New playback controls, volume management, and voter status overlays.
- **Media MiniBadge**: A sleek mini-badge to track Watch Party status even when navigating other parts of the app.

## 🎨 UI & User Experience
- **Core Chat Enhancements**: Major improvements to chat UI components for better message delivery and readability.
- **Theme Customization**: Integrated a new Theme Picker allowing users to personalize their interface.
- **Dynamic Visuals**: Added dominant gradient extraction for media assets to create an immersive background effect.
- **Enhanced Settings**: Added dedicated user preferences for Watch Party and refined the "About" section.

## 🛠 Technical Improvements
- **State Management**: Upgraded `watchPartyStore`, `authStore`, and `settingsStore` for better performance and data persistence.
- **Code Refinement**: Improved time formatting utilities and added various custom hooks for better modularity.

import {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { db } from "@/src/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  ProfileCard,
  ProfileThemePicker,
  ProfileBackgroundUploader,
  ProfileInfoEditor,
  AccountActions,
} from "../account-settings";
import ProfileAvatarUploader from "../account-settings/ProfileAvatarUploader";

const AccountSettings = forwardRef(
  ({ onClose, scrollToSection, setScrollToSection, contentRef }, ref) => {
    const { user, logout } = useAuthStore();
    const profileColor = useSettingsStore((state) => state.profileColor);
    const setProfileColor = useSettingsStore((state) => state.setProfileColor);
    const { servers } = useServerStore();
    const lastSyncedProfileColorRef = useRef(null);

    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [profileBgImage, setProfileBgImage] = useState(null);
    const [bio, setBio] = useState("");
    const [customStatus, setCustomStatus] = useState("");
    const [customStatusColor, setCustomStatusColor] = useState("#949ba4");

    // Load profile data
    useEffect(() => {
      const loadProfile = async () => {
        if (!user?.uid) return;

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setBio(data.bio || "");
            setCustomStatus(data.customStatus || "");
            setCustomStatusColor(data.customStatusColor || "#949ba4");
            setProfileBgImage(data.profileBgImage || null);
          }
        } catch (error) {
          console.error("Error loading profile:", error);
        }

        setIsLoadingProfile(false);
      };

      loadProfile();
    }, [user?.uid]);

    // Sync profileColor to Firestore user doc + all member docs (for avatar borders in chat / members)
    useEffect(() => {
      if (!user?.uid || !profileColor) return;

      // Aynı renk için tekrar tekrar yazma
      if (lastSyncedProfileColorRef.current === profileColor) return;

      const syncProfileColor = async () => {
        try {
          // 1) Kullanıcı ana profil dokümanı
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, { profileColor }).catch(() => {});

          // 2) Üye olduğu tüm sunuculardaki member dokümanları
          if (Array.isArray(servers) && servers.length > 0) {
            const tasks = servers.map((s) =>
              updateDoc(doc(db, "servers", s.id, "members", user.uid), {
                profileColor,
              }).catch(() => {}),
            );
            await Promise.all(tasks);
          }

          lastSyncedProfileColorRef.current = profileColor;
        } catch (err) {
          // Sessiz geç; tema değişimi UI'sini bozmasın
          console.warn("ProfileColor sync failed:", err);
        }
      };

      syncProfileColor();
    }, [user?.uid, profileColor, servers]);

    // Expose saveProfile to parent (for Settings Modal save button)
    useImperativeHandle(ref, () => ({
      saveProfile: () => {
        // ProfileInfoEditor handles its own save
        console.log("AccountSettings: Save triggered from parent");
      },
    }));

    if (isLoadingProfile) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
        <h3 className="text-xl font-bold text-white mb-3 relative">
          <span className="relative z-10">Hesabım</span>
        </h3>

        {/* 1. Profile Card (Includes Avatar Upload & Dominant Color Extraction) */}
        <ProfileCard user={user} profileColor={profileColor} bgImage={profileBgImage} />

        {/* 2. Profile Theme Picker */}
        <ProfileThemePicker
          profileColor={profileColor}
          setProfileColor={setProfileColor}
          user={user}
          bgImage={profileBgImage}
        />

        {/* 3. Profile Background Uploader (Includes Background Upload & Color Extraction) */}
        <ProfileBackgroundUploader
          user={user}
          profileBgImage={profileBgImage}
          setProfileBgImage={setProfileBgImage}
        />

        {/* 4. Profile Info Editor */}
        <ProfileInfoEditor
          user={user}
          initialBio={bio}
          initialStatus={customStatus}
          initialStatusColor={customStatusColor}
        />

        {/* 5. Account Actions */}
        <AccountActions user={user} logout={logout} onClose={onClose} />
      </div>
    );
  },
);

export default AccountSettings;

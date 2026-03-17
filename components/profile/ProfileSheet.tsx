// components/profile/ProfileSheet.tsx
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileContent } from "./ProfileContent";

const { width } = Dimensions.get("window");

interface ProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  userStatus: any;
  user: any;
}

export function ProfileSheet({
  visible,
  onClose,
  onLogout,
  userStatus,
  user,
}: ProfileSheetProps) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-width)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -width,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          opacity: backdropOpacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          transform: [{ translateX }],
          width: width * 0.82,
          backgroundColor: "#f9fafb",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          shadowColor: "#000",
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 20,
        }}
      >
        <View className="px-5 pt-4 pb-3 border-b border-gray-100">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight">
            My Profile
          </Text>
        </View>

        <ProfileContent
          onClose={onClose}
          showHeader={false}
          onLogout={onLogout}
        />
      </Animated.View>
    </Modal>
  );
}

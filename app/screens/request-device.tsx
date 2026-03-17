// app/screens/request-device.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  ImagePlus,
  Info,
  Package,
  Search,
  ShoppingBag,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

// Types
interface Item {
  _id: string;
  item_id: string;
  item_name: string;
  item_description: string;
  category: string;
  stock: number;
  available_stock: number;
  unit: string;
  status: string;
  requires_prescription: boolean;
  requires_med_cert: boolean;
  requires_brgy_cert: boolean;
  needs_fitting: boolean;
  size?: string;
  brand?: string;
  is_consumable: boolean;
  location: string;
  item_image_url?: string | null;
}

interface RequestItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  requires_prescription: boolean;
  prescription_image?: string;
  medical_certificate?: string;
}

interface RequestResponse {
  success: boolean;
  message: string;
  request: {
    request_id: string;
    status: string;
    queue_number: number;
    estimated_wait_time: number;
  };
}

// Category icons mapping
const categoryIcons: Record<string, any> = {
  "Mobility Aids": Package,
  "Medical Supplies": Package,
  "Assistive Devices": Package,
  Wheelchairs: Package,
  Crutches: Package,
  Canes: Package,
  "Hearing Aids": Package,
  Glasses: Package,
  Diapers: Package,
  Milk: Package,
  Medicines: Package,
  Vitamins: Package,
  default: Package,
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    "Mobility Aids": "bg-blue-50 border-blue-200",
    "Medical Supplies": "bg-green-50 border-green-200",
    "Assistive Devices": "bg-purple-50 border-purple-200",
    Wheelchairs: "bg-indigo-50 border-indigo-200",
    Crutches: "bg-amber-50 border-amber-200",
    Canes: "bg-orange-50 border-orange-200",
    "Hearing Aids": "bg-pink-50 border-pink-200",
    Glasses: "bg-cyan-50 border-cyan-200",
    Diapers: "bg-emerald-50 border-emerald-200",
    Milk: "bg-sky-50 border-sky-200",
    Medicines: "bg-rose-50 border-rose-200",
    Vitamins: "bg-lime-50 border-lime-200",
  };
  return colors[category] || "bg-gray-50 border-gray-200";
};

export default function RequestDeviceScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Request modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [purpose, setPurpose] = useState("");

  // Medical certificate states
  const [medicalCertImage, setMedicalCertImage] = useState<string | null>(null);
  const [medicalCertBase64, setMedicalCertBase64] = useState<string | null>(
    null,
  );

  // Prescription states (for prescription-required items)
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(
    null,
  );
  const [prescriptionBase64, setPrescriptionBase64] = useState<string | null>(
    null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<
    RequestResponse["request"] | null
  >(null);

  // Fetch items on mount
  useEffect(() => {
    fetchItems();
  }, []);

  // Filter items when search or category changes
  useEffect(() => {
    filterItems();
  }, [items, searchQuery, selectedCategory]);

  // Extract unique categories from items
  useEffect(() => {
    const uniqueCategories = [...new Set(items.map((item) => item.category))];
    setCategories(uniqueCategories);
  }, [items]);

  const fetchItems = async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Not authenticated");
        return;
      }

      console.log("[request-device] Fetching items...");
      const res = await fetch(`${EXPRESS_API_BASE}/api/items?available=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch items");
      }

      const data = await res.json();
      console.log("[request-device] Items fetched:", data.items?.length || 0);

      setItems(data.items || []);
    } catch (err) {
      console.error("[request-device] fetch error:", err);
      setError("Failed to load available devices. Pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(`${EXPRESS_API_BASE}/api/items/categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error("[request-device] fetch categories error:", err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchItems(), fetchCategories()]);
    setRefreshing(false);
  };

  const filterItems = () => {
    let filtered = [...items];

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.item_name.toLowerCase().includes(query) ||
          item.item_description?.toLowerCase().includes(query) ||
          item.brand?.toLowerCase().includes(query),
      );
    }

    setFilteredItems(filtered);
  };

  const handleItemPress = (item: Item) => {
    setSelectedItem(item);
    setQuantity("1");
    setPurpose("");
    setMedicalCertImage(null);
    setMedicalCertBase64(null);
    setPrescriptionImage(null);
    setPrescriptionBase64(null);
    setModalVisible(true);
  };

  const handlePickImage = async (
    setImage: (uri: string | null) => void,
    setBase64: (base64: string | null) => void,
    title: string,
  ) => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Needed",
          `Photo library access is required to upload ${title}.`,
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const mime = asset.mimeType ?? "image/jpeg";
      setImage(asset.uri);
      setBase64(`data:${mime};base64,${asset.base64}`);
    } catch (err) {
      console.error(`[request-device] ${title} pick error:`, err);
      Alert.alert("Error", `Failed to pick ${title}. Please try again.`);
    }
  };

  const validateForm = () => {
    if (!selectedItem) return false;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1) {
      Alert.alert(
        "Invalid Quantity",
        "Please enter a valid quantity (minimum 1).",
      );
      return false;
    }

    if (qty > selectedItem.available_stock) {
      Alert.alert(
        "Insufficient Stock",
        `Only ${selectedItem.available_stock} ${selectedItem.unit}(s) available.`,
      );
      return false;
    }

    if (selectedItem.requires_prescription && !prescriptionBase64) {
      Alert.alert(
        "Prescription Required",
        "This item requires a valid prescription. Please upload a photo of your prescription.",
      );
      return false;
    }

    if (selectedItem.requires_med_cert && !medicalCertBase64) {
      Alert.alert(
        "Medical Certificate Required",
        "This item requires a medical certificate. Please upload a photo of your medical certificate.",
      );
      return false;
    }

    if (purpose.trim().length < 10) {
      Alert.alert(
        "Purpose Required",
        "Please provide a brief purpose for this request (minimum 10 characters).",
      );
      return false;
    }

    return true;
  };

  const handleSubmitRequest = async () => {
    if (!validateForm() || !selectedItem) return;

    setSubmitting(true);

    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      // Build request payload according to backend expectations
      const requestPayload: any = {
        items: [
          {
            item_id: selectedItem.item_id,
            quantity: parseInt(quantity),
          },
        ],
        purpose: purpose.trim(),
        priority: "Normal",
        is_emergency: false,
      };

      // Add prescription image if available
      if (selectedItem.requires_prescription && prescriptionBase64) {
        requestPayload.items[0].prescription_image = prescriptionBase64;
      }

      // Add medical certificate if available
      if (selectedItem.requires_med_cert && medicalCertBase64) {
        requestPayload.items[0].medical_certificate = medicalCertBase64;
      }

      console.log("[request-device] Submitting request:", requestPayload);

      const res = await fetch(`${EXPRESS_API_BASE}/api/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || data.message || "Failed to submit request",
        );
      }

      setRequestSuccess(data.request);
      setModalVisible(false);
    } catch (err: any) {
      console.error("[request-device] submit error:", err);
      Alert.alert(
        "Error",
        err.message || "Failed to submit request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const CategoryIcon = categoryIcons[item.category] || categoryIcons.default;
    const categoryColor = getCategoryColor(item.category);

    return (
      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
        <Pressable
          onPress={() => handleItemPress(item)}
          android_ripple={{ color: "#f3f4f6" }}
        >
          <View className="p-4">
            <View className="flex-row gap-3">
              {/* Item Image or Icon */}
              <View
                className={`w-16 h-16 rounded-xl items-center justify-center ${categoryColor}`}
              >
                {item.item_image_url ? (
                  <Image
                    source={{ uri: item.item_image_url }}
                    className="w-full h-full rounded-xl"
                    resizeMode="cover"
                  />
                ) : (
                  <CategoryIcon size={28} color="#6B7280" />
                )}
              </View>

              {/* Item Details */}
              <View className="flex-1">
                <View className="flex-row justify-between items-start">
                  <Text className="text-gray-900 font-bold text-[16px] flex-1 mr-2">
                    {item.item_name}
                  </Text>
                </View>

                {item.brand && (
                  <Text className="text-gray-400 text-[11px] mt-0.5">
                    Brand: {item.brand}
                  </Text>
                )}

                {item.size && (
                  <Text className="text-gray-400 text-[11px]">
                    Size: {item.size}
                  </Text>
                )}

                {/* Stock Info */}
                <View className="flex-row items-center mt-1">
                  <View className="bg-green-50 px-2 py-0.5 rounded-full border border-green-200 mr-2">
                    <Text className="text-green-700 text-[9px] font-semibold">
                      Stock: {item.available_stock} {item.unit}s
                    </Text>
                  </View>
                </View>

                {/* Requirements Badges */}
                <View className="flex-row flex-wrap gap-1 mt-2">
                  {item.requires_prescription && (
                    <View className="bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <Text className="text-amber-700 text-[8px] font-semibold">
                        Rx Required
                      </Text>
                    </View>
                  )}
                  {item.requires_med_cert && (
                    <View className="bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      <Text className="text-purple-700 text-[8px] font-semibold">
                        Med Cert Required
                      </Text>
                    </View>
                  )}
                  {item.needs_fitting && (
                    <View className="bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      <Text className="text-blue-700 text-[8px] font-semibold">
                        Fitting
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Item Description */}
            {item.item_description && (
              <Text
                className="text-gray-500 text-[12px] mt-3 leading-5"
                numberOfLines={2}
              >
                {item.item_description}
              </Text>
            )}

            {/* Request Button */}
            <TouchableOpacity
              onPress={() => handleItemPress(item)}
              className="mt-3 bg-green-50 py-2 rounded-xl border border-green-200"
              activeOpacity={0.7}
            >
              <Text className="text-green-700 text-center font-semibold text-[13px]">
                Request This Device
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </View>
    );
  };

  // Success View
  if (requestSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
            <CheckCircle2 size={44} color="#059669" strokeWidth={2} />
          </View>
          <Text className="text-gray-900 text-2xl font-bold text-center mb-2">
            Request Submitted!
          </Text>
          <Text className="text-gray-500 text-base text-center leading-6 mb-4">
            Your device request has been received and is now in queue.
          </Text>

          <View className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 mb-8 w-full">
            <Text className="text-green-700 text-xs font-semibold text-center tracking-widest uppercase mb-1">
              Request Number
            </Text>
            <Text className="text-green-900 text-lg font-bold text-center tracking-widest">
              {requestSuccess.request_id}
            </Text>
            <View className="flex-row justify-center items-center gap-2 mt-2">
              <Clock size={14} color="#059669" />
              <Text className="text-green-700 text-sm">
                Est. wait time: {requestSuccess.estimated_wait_time} minutes
              </Text>
            </View>
            <View className="flex-row justify-center items-center gap-2 mt-1">
              <ShoppingBag size={14} color="#059669" />
              <Text className="text-green-700 text-sm">
                Queue position: #{requestSuccess.queue_number}
              </Text>
            </View>
          </View>

          <Pressable
            className="w-full bg-green-900 rounded-2xl py-4 items-center active:bg-green-800"
            onPress={() => router.replace("/(tabs)")}
          >
            <Text className="text-white font-bold text-base">Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center gap-3 border-b border-gray-100 bg-white">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
        >
          <ArrowLeft size={18} color="#374151" strokeWidth={2} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
            Request Device
          </Text>
          <Text className="text-gray-400 text-[12px] mt-0.5">
            Browse and request available devices
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-5 py-3 bg-white border-b border-gray-100">
        <View className="bg-gray-50 rounded-2xl px-4 py-2 flex-row items-center gap-2 border border-gray-200">
          <Search size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 text-[14px] text-gray-900 py-2"
            placeholder="Search devices by name or brand..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <XCircle size={16} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Categories Filter */}
      {categories.length > 0 && (
        <View className="bg-white border-b border-gray-100">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="py-3 px-5"
          >
            <Pressable
              onPress={() => setSelectedCategory(null)}
              className={`mr-2 px-4 py-2 rounded-full border ${
                selectedCategory === null
                  ? "bg-green-900 border-green-900"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Text
                className={`text-[12px] font-semibold ${
                  selectedCategory === null ? "text-white" : "text-gray-600"
                }`}
              >
                All
              </Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                className={`mr-2 px-4 py-2 rounded-full border ${
                  selectedCategory === category
                    ? "bg-green-900 border-green-900"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <Text
                  className={`text-[12px] font-semibold ${
                    selectedCategory === category
                      ? "text-white"
                      : "text-gray-600"
                  }`}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Items List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading available devices...
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-red-50 rounded-2xl items-center justify-center mb-4">
            <AlertCircle size={28} color="#dc2626" />
          </View>
          <Text className="text-gray-900 text-[16px] font-bold text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-gray-400 text-[13px] text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={onRefresh}
            className="bg-green-900 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : filteredItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-gray-50 rounded-3xl items-center justify-center mb-4">
            <Package size={32} color="#9ca3af" />
          </View>
          <Text className="text-gray-900 text-[18px] font-bold text-center mb-2">
            No Devices Available
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-8">
            {searchQuery || selectedCategory
              ? "No devices match your search criteria. Try adjusting your filters."
              : "There are no devices available for request at the moment."}
          </Text>
          {(searchQuery || selectedCategory) && (
            <Pressable
              onPress={() => {
                setSearchQuery("");
                setSelectedCategory(null);
              }}
              className="bg-green-900 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Clear Filters</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="mb-3">
              <Text className="text-gray-400 text-[12px] font-medium">
                {filteredItems.length} device(s) available
              </Text>
            </View>
          }
        />
      )}

      {/* Request Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl">
              {/* Modal Header */}
              <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-gray-900 text-[18px] font-bold">
                    Request Device
                  </Text>
                  <Text className="text-gray-400 text-[12px] mt-0.5">
                    {selectedItem?.item_name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <XCircle size={16} color="#6B7280" />
                </Pressable>
              </View>

              <ScrollView className="max-h-[80%] px-5 py-4">
                {/* Item Info */}
                {selectedItem && (
                  <View className="bg-green-50 rounded-2xl p-4 border border-green-200 mb-4">
                    <View className="flex-row items-center gap-3">
                      <View className="w-12 h-12 bg-white rounded-xl items-center justify-center">
                        <Package size={24} color="#166534" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-green-800 font-bold text-[15px]">
                          {selectedItem.item_name}
                        </Text>
                        <Text className="text-green-600 text-[11px] mt-0.5">
                          Available: {selectedItem.available_stock}{" "}
                          {selectedItem.unit}s
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Quantity Input */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-[13px] font-bold mb-2">
                    Quantity <Text className="text-red-400">*</Text>
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => {
                        const qty = parseInt(quantity);
                        if (qty > 1) setQuantity((qty - 1).toString());
                      }}
                      className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                    >
                      <Text className="text-gray-600 text-[18px] font-bold">
                        -
                      </Text>
                    </Pressable>
                    <TextInput
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 text-center"
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Pressable
                      onPress={() => {
                        const qty = parseInt(quantity);
                        if (qty < (selectedItem?.available_stock || 0)) {
                          setQuantity((qty + 1).toString());
                        }
                      }}
                      className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center"
                    >
                      <Text className="text-gray-600 text-[18px] font-bold">
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Purpose */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-[13px] font-bold mb-2">
                    Purpose <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900"
                    placeholder="Why do you need this device?"
                    placeholderTextColor="#9ca3af"
                    value={purpose}
                    onChangeText={setPurpose}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Prescription Upload */}
                {selectedItem?.requires_prescription && (
                  <View className="mb-4">
                    <Text className="text-gray-700 text-[13px] font-bold mb-2">
                      Prescription <Text className="text-red-400">*</Text>
                    </Text>
                    {prescriptionImage ? (
                      <View>
                        <Image
                          source={{ uri: prescriptionImage }}
                          className="w-full h-40 rounded-xl"
                          resizeMode="cover"
                        />
                        <View className="flex-row mt-2">
                          <Pressable
                            onPress={() =>
                              handlePickImage(
                                setPrescriptionImage,
                                setPrescriptionBase64,
                                "prescription",
                              )
                            }
                            className="flex-1 bg-gray-100 py-2 rounded-xl items-center mr-2"
                          >
                            <Text className="text-gray-600 text-[12px] font-semibold">
                              Replace
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setPrescriptionImage(null);
                              setPrescriptionBase64(null);
                            }}
                            className="flex-1 bg-red-50 py-2 rounded-xl items-center"
                          >
                            <Text className="text-red-600 text-[12px] font-semibold">
                              Remove
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() =>
                          handlePickImage(
                            setPrescriptionImage,
                            setPrescriptionBase64,
                            "prescription",
                          )
                        }
                        className="border-2 border-dashed border-gray-300 rounded-xl py-6 items-center justify-center gap-2"
                      >
                        <ImagePlus size={24} color="#9ca3af" />
                        <Text className="text-gray-600 font-semibold text-[13px]">
                          Upload Prescription
                        </Text>
                        <Text className="text-gray-400 text-[11px] text-center px-4">
                          Take a photo of your valid prescription
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Medical Certificate Upload */}
                {selectedItem?.requires_med_cert && (
                  <View className="mb-4">
                    <Text className="text-gray-700 text-[13px] font-bold mb-2">
                      Medical Certificate{" "}
                      <Text className="text-red-400">*</Text>
                    </Text>
                    {medicalCertImage ? (
                      <View>
                        <Image
                          source={{ uri: medicalCertImage }}
                          className="w-full h-40 rounded-xl"
                          resizeMode="cover"
                        />
                        <View className="flex-row mt-2">
                          <Pressable
                            onPress={() =>
                              handlePickImage(
                                setMedicalCertImage,
                                setMedicalCertBase64,
                                "medical certificate",
                              )
                            }
                            className="flex-1 bg-gray-100 py-2 rounded-xl items-center mr-2"
                          >
                            <Text className="text-gray-600 text-[12px] font-semibold">
                              Replace
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setMedicalCertImage(null);
                              setMedicalCertBase64(null);
                            }}
                            className="flex-1 bg-red-50 py-2 rounded-xl items-center"
                          >
                            <Text className="text-red-600 text-[12px] font-semibold">
                              Remove
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() =>
                          handlePickImage(
                            setMedicalCertImage,
                            setMedicalCertBase64,
                            "medical certificate",
                          )
                        }
                        className="border-2 border-dashed border-gray-300 rounded-xl py-6 items-center justify-center gap-2"
                      >
                        <FileText size={24} color="#9ca3af" />
                        <Text className="text-gray-600 font-semibold text-[13px]">
                          Upload Medical Certificate
                        </Text>
                        <Text className="text-gray-400 text-[11px] text-center px-4">
                          Take a photo of your medical certificate
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Requirements Notice */}
                {selectedItem?.needs_fitting && (
                  <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex-row gap-3">
                    <Info size={18} color="#2563EB" />
                    <Text className="text-blue-700 text-[12px] leading-5 flex-1">
                      This device requires fitting. A staff member will contact
                      you to schedule an appointment.
                    </Text>
                  </View>
                )}

                {selectedItem?.requires_brgy_cert && (
                  <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex-row gap-3">
                    <HelpCircle size={18} color="#D97706" />
                    <Text className="text-amber-700 text-[12px] leading-5 flex-1">
                      Barangay certificate may be required. Please bring it when
                      claiming.
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Modal Footer */}
              <View className="px-5 pt-3 pb-6 border-t border-gray-100">
                <Pressable
                  onPress={handleSubmitRequest}
                  disabled={submitting}
                  className={`rounded-2xl py-4 items-center ${
                    submitting ? "bg-green-700 opacity-75" : "bg-green-900"
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-[15px]">
                      Submit Request
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

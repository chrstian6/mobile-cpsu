import {
  Award,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const services = [
  {
    category: "Registration",
    items: [
      {
        title: "New PWD Registration",
        icon: UserPlus,
        description: "Register a new person with disability",
      },
      { title: "ID Application", icon: Award, description: "Apply for PWD ID" },
    ],
  },
  {
    category: "Assistance",
    items: [
      {
        title: "Financial Assistance",
        icon: FileText,
        description: "Apply for financial aid",
      },
      {
        title: "Medical Assistance",
        icon: RefreshCw,
        description: "Request medical support",
      },
    ],
  },
  {
    category: "Updates",
    items: [
      {
        title: "Renewal",
        icon: RefreshCw,
        description: "Renew PWD ID or benefits",
      },
      {
        title: "Update Information",
        icon: FileText,
        description: "Update personal details",
      },
    ],
  },
];

export default function ServicesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View className="px-6 pt-4">
          <View className="bg-white rounded-2xl p-4 flex-row items-center shadow-sm">
            <Search size={20} color="#9ca3af" />
            <Text className="text-gray-400 ml-3 flex-1">
              Search services...
            </Text>
          </View>
        </View>

        {/* Services List */}
        <View className="px-6 pt-6 pb-8">
          {services.map((category, categoryIndex) => (
            <View key={categoryIndex} className="mb-6">
              <Text className="text-gray-900 text-lg font-bold mb-3">
                {category.category}
              </Text>
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {category.items.map((service, serviceIndex) => {
                  const Icon = service.icon;
                  return (
                    <Pressable
                      key={serviceIndex}
                      className={`p-4 flex-row items-center ${serviceIndex !== category.items.length - 1 ? "border-b border-gray-100" : ""}`}
                    >
                      <View className="bg-green-100 w-12 h-12 rounded-full items-center justify-center">
                        <Icon size={24} color="#166534" />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-gray-900 font-semibold">
                          {service.title}
                        </Text>
                        <Text className="text-gray-500 text-sm mt-0.5">
                          {service.description}
                        </Text>
                      </View>
                      <ChevronRight size={20} color="#9ca3af" />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

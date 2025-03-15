import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  Image,
  TouchableOpacity,
  PermissionsAndroid,
  ScrollView,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from "react-native-vision-camera";
import { Ionicons } from "@expo/vector-icons";
import MlkitOcr from "react-native-mlkit-ocr";

export default function App() {
  const camera = useRef(null);
  const device = useCameraDevice("back");
  const format = useCameraFormat(device, [{ aspectRatio: "16:9" }]);
  const { hasPermission, requestPermission: requestCameraPermission } =
    useCameraPermission();
  const [photoUri, setPhotoUri] = useState(null);
  const [flashMode, setFlashMode] = useState("off");
  const [extractedText, setExtractedText] = useState("");
  const [permissionDeniedCount, setPermissionDeniedCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Xử lý yêu cầu quyền camera với kiểm tra từ chối nhiều lần
  const requestPermission = async () => {
    try {
      const permission = await requestCameraPermission();
      if (permission !== "authorized") {
        setPermissionDeniedCount((prev) => prev + 1);
        if (permissionDeniedCount >= 2) {
          Alert.alert(
            "Cần quyền camera",
            "Ứng dụng không thể hoạt động nếu không có quyền camera. Vui lòng vào Cài đặt để cấp quyền.",
            [
              { text: "Hủy" },
              {
                text: "Đi đến Cài đặt",
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error("Lỗi yêu cầu quyền camera:", error);
    }
  };

  // Kiểm tra quyền camera khi ứng dụng khởi động
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, []);

  // Chuyển đổi chế độ flash
  const toggleFlash = () => {
    setFlashMode((prev) => (prev === "off" ? "on" : "off"));
  };

  // Hàm OCR thống nhất cho mọi loại URI
  const recognizeText = async (imageUri) => {
    try {
      console.log("Sending to OCR:", imageUri);

      // Kiểm tra imageUri có phải là đường dẫn hợp lệ không
      if (
        !imageUri ||
        typeof imageUri !== "string" ||
        !imageUri.startsWith("file://")
      ) {
        throw new Error("Đường dẫn ảnh không hợp lệ");
      }

      const result = await MlkitOcr.detectFromUri(imageUri);
      console.log("OCR result:", result);

      const text = result.map((block) => block.text).join("\n");
      setExtractedText(text || "Không tìm thấy văn bản.");
    } catch (error) {
      const errorMessage = error?.message || "Lỗi không xác định";
      setExtractedText("Lỗi trích xuất văn bản: " + errorMessage);
      console.error("OCR Error:", error);
    }
  };

  // Chụp ảnh
  const takePhoto = async () => {
    if (!hasPermission) {
      Alert.alert(
        "Thiếu quyền",
        "Bạn cần cấp quyền camera để sử dụng chức năng này.",
        [{ text: "Hủy" }, { text: "Cấp quyền", onPress: requestPermission }]
      );
      return;
    }

    if (camera.current) {
      try {
        setIsProcessing(true);
        // KHÔNG yêu cầu base64 nữa
        const photo = await camera.current.takePhoto({
          flash: flashMode,
          // Bỏ base64: true
        });

        // Sử dụng đường dẫn file trực tiếp
        console.log("Photo data:", photo); // In ra để kiểm tra cấu trúc

        // Đối với VisionCamera, thường là photo.path
        if (photo && photo.path) {
          const filePath = `file://${photo.path}`;
          console.log("File path:", filePath);
          setPhotoUri(filePath);
          await recognizeText(filePath);
        } else {
          throw new Error("Không nhận được đường dẫn ảnh");
        }
      } catch (error) {
        const errorMessage = error?.message || "Lỗi không xác định";
        Alert.alert("Lỗi", "Không thể chụp ảnh: " + errorMessage);
        console.error("Camera error:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Chụp lại ảnh
  const retakePhoto = () => {
    setPhotoUri(null);
    setExtractedText("");
  };

  // Sao chép văn bản trích xuất
  const copyExtractedText = () => {
    if (
      extractedText &&
      extractedText !== "Không tìm thấy văn bản." &&
      !extractedText.startsWith("Lỗi")
    ) {
      Clipboard.setString(extractedText);
      Alert.alert("Thành công", "Đã sao chép văn bản vào bộ nhớ tạm.");
    } else {
      Alert.alert("Thông báo", "Không có văn bản để sao chép.");
    }
  };

  // Xử lý khi thiết bị không có camera
  if (!device) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy camera</Text>
        <Button
          title="Cấp quyền camera"
          onPress={requestPermission}
          color="#2196F3"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {photoUri ? (
        <ScrollView contentContainerStyle={styles.previewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.preview}
            resizeMode="contain"
          />
          <Text style={styles.sectionTitle}>Văn bản trích xuất:</Text>
          <View style={styles.textContainer}>
            <Text style={styles.extractedText}>{extractedText}</Text>
          </View>
          <View style={styles.buttonRow}>
            <Button title="Chụp lại" onPress={retakePhoto} color="#FF5722" />
            <Button
              title="Sao chép văn bản"
              onPress={copyExtractedText}
              color="#2196F3"
              disabled={
                !extractedText ||
                extractedText === "Không tìm thấy văn bản." ||
                extractedText.startsWith("Lỗi")
              }
            />
          </View>
        </ScrollView>
      ) : (
        <>
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
            format={format}
            orientation="portrait"
          />
          <View style={styles.overlay}>
            <View style={styles.rectangle} />
            <Text style={styles.overlayText}>Đặt văn bản vào khung</Text>
          </View>
          <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
            <Ionicons
              name={flashMode === "on" ? "flash" : "flash-off"}
              size={28}
              color={flashMode === "on" ? "#FFD700" : "#FFFFFF"}
            />
          </TouchableOpacity>

          <View style={styles.permissionPanel}>
            <Text style={styles.permissionTitle}>Trạng thái quyền:</Text>
            <View style={styles.permissionItem}>
              <Text style={styles.permissionLabel}>Camera:</Text>
              <Text
                style={
                  hasPermission
                    ? styles.permissionGranted
                    : styles.permissionDenied
                }
              >
                {hasPermission ? "Đã cấp ✓" : "Chưa cấp ✗"}
              </Text>
              {!hasPermission && (
                <Button
                  title="Cấp"
                  onPress={requestPermission}
                  color="#4CAF50"
                />
              )}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title={isProcessing ? "Đang xử lý..." : "Chụp ảnh"}
              onPress={takePhoto}
              color="#4CAF50"
              disabled={!hasPermission || isProcessing}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: "red",
    marginBottom: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  rectangle: {
    width: 280,
    height: 140,
    borderWidth: 3,
    borderColor: "#4CAF50",
    backgroundColor: "transparent",
  },
  overlayText: {
    color: "white",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 5,
    borderRadius: 5,
    marginTop: 10,
  },
  previewContainer: {
    padding: 20,
    alignItems: "center",
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#4CAF50",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  textContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    minHeight: 100,
    width: "100%",
    marginBottom: 20,
  },
  extractedText: {
    fontSize: 16,
    color: "#333",
    textAlign: "left",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  flashButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 30,
    padding: 10,
  },
  permissionPanel: {
    position: "absolute",
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    padding: 15,
    elevation: 5,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  permissionLabel: {
    fontSize: 14,
    color: "#555",
    width: 100,
  },
  permissionGranted: {
    color: "green",
    fontWeight: "bold",
  },
  permissionDenied: {
    color: "red",
    fontWeight: "bold",
  },
  buttonContainer: {
    position: "absolute",
    bottom: 20,
    width: "80%",
    alignSelf: "center",
  },
});

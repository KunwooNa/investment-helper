import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  AppState,
  Alert,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// ─── Configuration ──────────────────────────────────────────────────
// 배포 후 여기에 Vercel URL을 입력하세요
const WEB_APP_URL = "https://investment-helper.vercel.app";
const API_BASE = WEB_APP_URL + "/api";

// ─── Notification Handler ───────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Push Token Registration ────────────────────────────────────────
async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert(
      "알림 권한 필요",
      "매매 신호 알림을 받으려면 알림 권한을 허용해주세요.\n설정 > InvestView > 알림에서 변경할 수 있습니다.",
      [{ text: "확인" }]
    );
    return null;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });
    console.log("Push token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("Failed to get push token:", error);
    return null;
  }
}

// ─── Register device with backend ──────────────────────────────────
async function registerDevice(pushToken, watchlist) {
  try {
    const response = await fetch(`${API_BASE}/register-device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pushToken,
        watchlist,
        platform: Platform.OS,
        deviceName: Device.deviceName || "Unknown",
      }),
    });
    const data = await response.json();
    console.log("Device registered:", data);
    return data;
  } catch (error) {
    console.error("Failed to register device:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function App() {
  const [pushToken, setPushToken] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const webviewRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();
  const appState = useRef(AppState.currentState);

  // ─── Initialize Push Notifications ─────────────────────────────
  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications().then((token) => {
      if (token) {
        setPushToken(token);
      }
    });

    // Listen for incoming notifications (app in foreground)
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
        // Optionally refresh the WebView when a notification arrives
        if (webviewRef.current) {
          webviewRef.current.injectJavaScript(
            'if(window.onNativeNotification) window.onNativeNotification(); true;'
          );
        }
      });

    // Listen for notification taps (user tapped notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        console.log("Notification tapped:", data);

        // Navigate to the relevant stock in the web app
        if (data.symbol && webviewRef.current) {
          webviewRef.current.injectJavaScript(`
            if(window.onNotificationTap) {
              window.onNotificationTap(${JSON.stringify(data)});
            }
            true;
          `);
        }
      });

    // Handle app state changes (background → foreground)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground - refresh data
        if (webviewRef.current) {
          webviewRef.current.injectJavaScript(
            'if(window.loadStockData) window.loadStockData(); true;'
          );
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      subscription.remove();
    };
  }, []);

  // ─── Handle messages from WebView ──────────────────────────────
  const onWebViewMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case "WATCHLIST_UPDATE":
          // User changed their watchlist → register with backend
          console.log("Watchlist updated:", message.watchlist);
          if (pushToken) {
            await registerDevice(pushToken, message.watchlist);
          }
          break;

        case "APP_READY":
          // Web app is loaded → send push token info
          setIsConnected(true);
          if (webviewRef.current && pushToken) {
            webviewRef.current.injectJavaScript(`
              window.__PUSH_TOKEN__ = "${pushToken}";
              window.__IS_NATIVE_APP__ = true;
              if(window.onNativeReady) window.onNativeReady("${pushToken}");
              true;
            `);
          }
          break;

        case "REQUEST_REFRESH":
          // Manual refresh requested from web app
          console.log("Refresh requested");
          break;

        default:
          console.log("Unknown message from WebView:", message);
      }
    } catch (error) {
      console.error("Failed to parse WebView message:", error);
    }
  };

  // ─── JavaScript to inject into WebView ─────────────────────────
  const injectedJavaScript = `
    (function() {
      // Mark as native app
      window.__IS_NATIVE_APP__ = true;
      window.__PUSH_TOKEN__ = "${pushToken || ""}";

      // Override console.log to forward to native (for debugging)
      const origLog = console.log;
      console.log = function(...args) {
        origLog.apply(console, args);
      };

      // Notify native app that web is ready
      setTimeout(function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "APP_READY" }));
      }, 1000);

      // Listen for notification taps
      window.onNotificationTap = function(data) {
        // If the web app exposes navigation, use it
        if (data.symbol) {
          // This will be handled by the web app
          const event = new CustomEvent('nativeNavigate', { detail: data });
          window.dispatchEvent(event);
        }
      };

      // Refresh data when notification received
      window.onNativeNotification = function() {
        if (window.loadStockData) window.loadStockData();
      };

      true;
    })();
  `;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <WebView
        ref={webviewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        onMessage={onWebViewMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>IV</Text>
            </View>
            <Text style={styles.loadingText}>InvestView</Text>
            <Text style={styles.loadingSubtext}>로딩 중...</Text>
          </View>
        )}
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        overScrollMode="never"
        contentMode="mobile"
        // iOS specific
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Prevent external links from opening in WebView
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith(WEB_APP_URL) || request.url.startsWith("about:")) {
            return true;
          }
          // Open external links in system browser
          return false;
        }}
        // Handle errors
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("WebView error:", nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("HTTP error:", nativeEvent.statusCode);
        }}
      />

      {/* Connection status indicator (only shown briefly) */}
      {pushToken && !isConnected && (
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>알림 연결됨</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#3b82f6",
  },
  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: "#ffffff",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#64748b",
  },
  statusBar: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22c55e",
  },
});

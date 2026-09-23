import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { EngineProvider } from "./src/engineState";
import { Colors, FontSize, Spacing } from "./src/theme";
import BaseMapScreen from "./src/screens/BaseMapScreen";
import FuelScreen from "./src/screens/FuelScreen";
import IgnitionScreen from "./src/screens/IgnitionScreen";
import InjectorScreen from "./src/screens/InjectorScreen";
import SetupScreen from "./src/screens/SetupScreen";

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.surfaceAlt,
    border: Colors.border,
    text: Colors.text,
    primary: Colors.accent
  }
};

function SplashOverlay() {
  return (
    <View style={styles.splash}>
      <Image
        source={require("./assets/icon/android/playstore-icon.png")}
        style={styles.splashIcon}
        resizeMode="contain"
      />
      <Text style={styles.splashTitle}>Engine Mapping</Text>
      <Text style={styles.splashSub}>
        Base Map • Fuel • Ignition • Injector
      </Text>
    </View>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [overlayOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let mounted = true;

    SplashScreen.hideAsync();

    const fadeOut = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }).start(() => {
        if (mounted) setShowSplash(false);
      });
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(fadeOut);
    };
  }, [overlayOpacity]);

  return (
    <SafeAreaProvider>
      <EngineProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: Colors.surfaceAlt },
              headerTitleStyle: { color: Colors.text, fontWeight: "700" },
              tabBarStyle: {
                backgroundColor: Colors.surfaceAlt,
                borderTopColor: Colors.border
              },
              tabBarActiveTintColor: Colors.tabActive,
              tabBarInactiveTintColor: Colors.textDim
            }}
          >
            <Tab.Screen
              name="Setup"
              component={SetupScreen}
              options={{
                title: "Setup & Spek",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="construct" size={size} color={color} />
                )
              }}
            />
            <Tab.Screen
              name="BaseMap"
              component={BaseMapScreen}
              options={{
                title: "Base Map",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="stopwatch" size={size} color={color} />
                )
              }}
            />
            <Tab.Screen
              name="Fuel"
              component={FuelScreen}
              options={{
                title: "Fuel Corr",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="water" size={size} color={color} />
                )
              }}
            />
            <Tab.Screen
              name="Ignition"
              component={IgnitionScreen}
              options={{
                title: "Ignition",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="flash" size={size} color={color} />
                )
              }}
            />
            <Tab.Screen
              name="Injector"
              component={InjectorScreen}
              options={{
                title: "Inj. Timing",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="hourglass" size={size} color={color} />
                )
              }}
            />
          </Tab.Navigator>
          {showSplash && (
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
              pointerEvents="none"
            >
              <SplashOverlay />
            </Animated.View>
          )}
        </NavigationContainer>
      </EngineProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg
  },
  splashIcon: {
    width: 150,
    height: 150,
    borderRadius: 30
  },
  splashTitle: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: "800",
    marginTop: Spacing.xl,
    letterSpacing: 0.5
  },
  splashSub: {
    color: Colors.textDim,
    fontSize: FontSize.md,
    marginTop: Spacing.sm
  }
});

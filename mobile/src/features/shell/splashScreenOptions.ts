import * as SplashScreen from 'expo-splash-screen';

// Fades the splash screen out in 300 ms. Done on iOS only: on Android the
// system ends its own splash screen. Called once, before the first render.
export function setSplashScreenOptions() {
  SplashScreen.setOptions({ fade: true, duration: 300 });
}

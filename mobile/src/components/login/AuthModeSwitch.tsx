import React, { memo, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LogIn, UserPlus } from 'lucide-react-native';
import { colors } from '../../theme/colors';

export type AuthMode = 'login' | 'registro';

interface AuthModeSwitchProps {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

const ANIM = { duration: 240, easing: Easing.out(Easing.cubic) };

/**
 * Conmutador segmentado Ingresar / Crear cuenta.
 * El indicador se desliza en el hilo de UI; solo el texto cambia de color
 * cuando se alterna el modo (un re-render mínimo y predecible).
 */
export const AuthModeSwitch: React.FC<AuthModeSwitchProps> = memo(
  ({ mode, onChange }) => {
    const [trackWidth, setTrackWidth] = useState(0);
    const position = useSharedValue(mode === 'login' ? 0 : 1);

    useEffect(() => {
      position.value = withTiming(mode === 'login' ? 0 : 1, ANIM);
    }, [mode, position]);

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      if (width > 0 && width !== trackWidth) setTrackWidth(width);
    };

    const indicatorStyle = useAnimatedStyle(() => {
      const segment = trackWidth / 2;
      return {
        transform: [{ translateX: position.value * segment }],
      };
    });

    return (
      <View style={styles.track} onLayout={handleLayout}>
        {trackWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              { width: Math.max(trackWidth / 2 - 6, 0) },
              indicatorStyle,
            ]}
          />
        )}

        <Pressable
          style={styles.segment}
          onPress={() => onChange('login')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'login' }}
        >
          <LogIn
            size={14}
            color={mode === 'login' ? colors.textOnPrimary : colors.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              mode === 'login' && styles.segmentTextActive,
            ]}
          >
            Ingresar
          </Text>
        </Pressable>

        <Pressable
          style={styles.segment}
          onPress={() => onChange('registro')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'registro' }}
        >
          <UserPlus
            size={14}
            color={mode === 'registro' ? colors.textOnPrimary : colors.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              mode === 'registro' && styles.segmentTextActive,
            ]}
          >
            Crear cuenta
          </Text>
        </Pressable>
      </View>
    );
  }
);
AuthModeSwitch.displayName = 'AuthModeSwitch';

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 42,
    borderRadius: 13,
    padding: 3,
    backgroundColor: 'rgba(0, 0, 32, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.16)',
    marginBottom: 16,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 10,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
  },
});
